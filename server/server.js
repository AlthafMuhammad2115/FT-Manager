require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const ProductionModel = require('./models/Production');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

// Database Configuration: use 'test_ft_manager_2_0' if in test mode, else 'ft_manager_2_0'
const isTestMode =
  process.env.USE_TEST_DB === 'true' ||
  process.env.TEST_MODE === 'true' ||
  process.env.NODE_ENV === 'test' ||
  process.argv.includes('--test');

const DB_NAME = process.env.DB_NAME || (isTestMode ? 'test_ft_manager_2_0' : 'ft_manager_2_0');

// ==========================================
// HELPER UTILITIES
// ==========================================

// Format serial: prefix + zero-padded number
function formatSerial(prefix, num, pad = 5) {
  return `${prefix}${String(num).padStart(pad, '0')}`;
}

// Generate units array from startNum and dailyTarget
function generateUnits(prefix, startNum, dailyTarget) {
  const units = [];
  for (let i = 0; i < dailyTarget; i++) {
    const num = startNum + i;
    units.push({
      serial: formatSerial(prefix, num),
      num,
      assembly: 'pending',
      ft: 'pending',
      dlc: 'pending',
      oqc: 'pending',
      shipment: 'pending',
      isOverdue: false
    });
  }
  return units;
}

// Compute stage summaries from units array
function computeStageSummaries(units, prefix, startNum, dailyTarget) {
  const endNum = startNum + dailyTarget - 1;
  const startSerial = formatSerial(prefix, startNum);
  const endSerial = formatSerial(prefix, endNum);
  const totalUnits = units.length; // includes overdue carry-overs

  let assemblyDone = 0;
  let ftDone = 0;
  let dlcDone = 0;
  let oqcDone = 0;
  let shipmentDone = 0;

  for (const unit of units) {
    if (unit.assembly === 'done') assemblyDone++;
    if (unit.ft === 'done') ftDone++;
    if (unit.dlc === 'done') dlcDone++;
    if (unit.oqc === 'done') oqcDone++;
    if (unit.shipment === 'done') shipmentDone++;
  }

  return {
    assembly: {
      id: 'assembly',
      name: 'Assembly',
      subtext: 'Mechanical & Sub-Assembly Build',
      doneCount: assemblyDone,
      totalCount: totalUnits,
      startSerial,
      endSerial
    },
    ft: {
      id: 'ft',
      name: 'FT',
      fullName: 'Functional Testing',
      subtext: 'Automated QA & Diagnostics',
      doneCount: ftDone,
      totalCount: totalUnits,
      startSerial,
      endSerial
    },
    dlc: {
      id: 'dlc',
      name: 'DLC',
      fullName: 'Device Life Cycle',
      subtext: 'Final Calibration & Burn-In',
      doneCount: dlcDone,
      totalCount: totalUnits,
      startSerial,
      endSerial
    },
    oqc: {
      id: 'oqc',
      name: 'OQC',
      fullName: 'Outgoing Quality Control',
      subtext: 'Inspection & Compliance',
      doneCount: oqcDone,
      totalCount: totalUnits,
      startSerial,
      endSerial
    },
    shipment: {
      id: 'shipment',
      name: 'Shipment',
      fullName: 'Shipment & Dispatch',
      subtext: 'Packaging & Logistics Dispatch',
      doneCount: shipmentDone,
      totalCount: totalUnits,
      startSerial,
      endSerial
    }
  };
}

// Build full state object for API/WebSocket responses
function buildFullState(state) {
  const stages = computeStageSummaries(
    state.units,
    state.prefix,
    state.startNum,
    state.dailyTarget
  );

  return {
    productName: state.productName,
    prefix: state.prefix,
    startNum: state.startNum,
    dailyTarget: state.dailyTarget,
    shift: state.shift,
    shiftMode: state.shiftMode,
    lastUpdated: state.lastUpdated,
    units: state.units,
    stages
  };
}

// Shift Determination Helper (2 Active Shifts: 6am-2pm, 2pm-10pm in IST / Asia/Kolkata)
function getAutoShift() {
  const now = new Date();
  let hours = now.getHours();
  try {
    const istHour = parseInt(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        hour12: false
      }).format(now),
      10
    );
    if (!isNaN(istHour)) {
      hours = istHour;
    }
  } catch (e) {
    hours = now.getHours();
  }

  if (hours >= 6 && hours < 14) {
    return 'Morning Shift (06:00 - 14:00)';
  } else if (hours >= 14 && hours < 22) {
    return 'Evening Shift (14:00 - 22:00)';
  } else {
    return 'Off-Shift (22:00 - 06:00)';
  }
}

// Validate cascading: can a unit be modified at this stage?
// Pipeline: assembly -> ft -> dlc -> oqc -> shipment
function canEditUnitAtStage(unit, stage) {
  if (stage === 'assembly') return true;
  if (stage === 'ft') return unit.assembly === 'done';
  if (stage === 'dlc') return unit.ft === 'done';
  if (stage === 'oqc') return unit.dlc === 'done';
  if (stage === 'shipment') return unit.oqc === 'done';
  return false;
}

// Get the prerequisite stage name for user-friendly error messages
function getPrerequisiteStage(stage) {
  switch (stage) {
    case 'ft': return 'Assembly';
    case 'dlc': return 'FT';
    case 'oqc': return 'DLC';
    case 'shipment': return 'OQC';
    default: return '';
  }
}

// ==========================================
// IN-MEMORY STATE
// ==========================================

let productionState = {
  productName: 'PROTEUS',
  prefix: 'PST',
  startNum: 20001,
  dailyTarget: 50,
  shift: getAutoShift(),
  shiftMode: 'auto',
  lastUpdated: new Date().toISOString(),
  units: generateUnits('PST', 20001, 50)
};

// ==========================================
// MONGODB PERSISTENCE
// ==========================================

async function saveData() {
  try {
    productionState.lastUpdated = new Date().toISOString();
    if (mongoose.connection.readyState === 1) {
      await ProductionModel.findOneAndUpdate(
        { key: 'current_production_state' },
        {
          $set: {
            key: 'current_production_state',
            productName: productionState.productName,
            prefix: productionState.prefix,
            startNum: productionState.startNum,
            dailyTarget: productionState.dailyTarget,
            shift: productionState.shift,
            shiftMode: productionState.shiftMode,
            lastUpdated: productionState.lastUpdated,
            units: productionState.units
          }
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );
      console.log('✅ MongoDB Synced:', new Date().toLocaleTimeString());
    } else {
      console.warn('⚠️ MongoDB not connected yet (readyState:', mongoose.connection.readyState, ')');
    }
  } catch (err) {
    console.error('❌ MongoDB save error:', err.message);
  }
}

async function initMongoDB() {
  if (!MONGODB_URI) {
    console.warn('⚠️  MONGODB_URI is not set in .env! Using in-memory state only.');
    return;
  }

  try {
    console.log(`🔄 Connecting to MongoDB database '${DB_NAME}'${isTestMode ? ' [TEST MODE]' : ''}...`);
    await mongoose.connect(MONGODB_URI, { dbName: DB_NAME });
    console.log(`✅ Connected to MongoDB successfully! Database: ${DB_NAME}`);

    // Fetch existing state from MongoDB
    const existingDoc = await ProductionModel.findOne({ key: 'current_production_state' }).lean();
    if (existingDoc && existingDoc.units && existingDoc.units.length > 0) {
      console.log('📥 Loaded production state from MongoDB (' + existingDoc.units.length + ' units).');
      
      // Ensure existing units have all stages present (including oqc and shipment)
      const sanitizedUnits = existingDoc.units.map(u => ({
        serial: u.serial,
        num: u.num,
        assembly: u.assembly || 'pending',
        ft: u.ft || 'pending',
        dlc: u.dlc || 'pending',
        oqc: u.oqc || 'pending',
        shipment: u.shipment || 'pending',
        isOverdue: u.isOverdue || false
      }));

      productionState = {
        productName: existingDoc.productName || 'PROTEUS',
        prefix: existingDoc.prefix || 'PST',
        startNum: existingDoc.startNum || 20001,
        dailyTarget: existingDoc.dailyTarget || 50,
        shift: (existingDoc.shiftMode === 'manual' && existingDoc.shift) ? existingDoc.shift : getAutoShift(),
        shiftMode: existingDoc.shiftMode || 'auto',
        lastUpdated: existingDoc.lastUpdated || new Date().toISOString(),
        units: sanitizedUnits
      };

      io.emit('production_updated', buildFullState(productionState));
    } else {
      console.log('📤 Initializing fresh production state in MongoDB...');
      await saveData();
      console.log('✅ Production state created in MongoDB.');
    }
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err.message);
  }
}

// Start MongoDB connection immediately
initMongoDB();

// Background timer: Checks and updates shift automatically every 15 seconds
setInterval(() => {
  if (productionState.shiftMode !== 'manual') {
    const expectedShift = getAutoShift();
    if (productionState.shift !== expectedShift) {
      productionState.shift = expectedShift;
      saveData();
      io.emit('production_updated', buildFullState(productionState));
      io.emit('shift_changed', { shift: expectedShift });
    }
  }
}, 15000);

// ==========================================
// EXPRESS MIDDLEWARE
// ==========================================

app.use(cors());
app.use(express.json());

// ==========================================
// AUTHENTICATION
// ==========================================

const ADMIN_ACCOUNTS = {
  admin_anora: {
    username: 'admin_anora',
    passwords: ['Anora@12#'],
    role: 'Super Administrator',
    allowedStages: ['assembly', 'ft', 'dlc', 'oqc', 'shipment'],
    canBatchConfig: true
  },
  admin_assembly: {
    username: 'admin_assembly',
    passwords: ['admin_pass'],
    role: 'Assembly Line Supervisor',
    allowedStages: ['assembly'],
    canBatchConfig: false
  },
  admin_ft: {
    username: 'admin_ft',
    passwords: ['admin_pass'],
    role: 'FT Station Supervisor',
    allowedStages: ['ft'],
    canBatchConfig: false
  },
  admin_dlc: {
    username: 'admin_dlc',
    passwords: ['admin_pass'],
    role: 'DLC Station Supervisor',
    allowedStages: ['dlc'],
    canBatchConfig: false
  },
  admin_oqc: {
    username: 'admin_oqc',
    passwords: ['admin_pass'],
    role: 'OQC Station Supervisor',
    allowedStages: ['oqc'],
    canBatchConfig: false
  },
  admin_shipment: {
    username: 'admin_shipment',
    passwords: ['admin_pass'],
    role: 'Shipment & Dispatch Supervisor',
    allowedStages: ['shipment'],
    canBatchConfig: false
  },
  admin_user: {
    username: 'admin_user',
    passwords: ['admin_pass'],
    role: 'Administrator',
    allowedStages: ['assembly', 'ft', 'dlc', 'oqc', 'shipment'],
    canBatchConfig: true
  }
};

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required' });
  }

  const userKey = username.trim().toLowerCase();
  const account = ADMIN_ACCOUNTS[userKey];

  if (account && account.passwords.includes(password.trim())) {
    const token = 'token-' + Buffer.from(`${account.username}-${Date.now()}`).toString('base64');
    return res.json({
      success: true,
      token,
      user: {
        username: account.username,
        role: account.role,
        allowedStages: account.allowedStages,
        canBatchConfig: account.canBatchConfig,
        authenticatedAt: new Date().toISOString()
      }
    });
  }

  return res.status(401).json({
    success: false,
    message: 'Invalid username or password. Please check your credentials.'
  });
});

app.post('/api/auth/verify', (req, res) => {
  const { token } = req.body;
  if (token && token.startsWith('token-')) {
    try {
      const decoded = Buffer.from(token.replace('token-', ''), 'base64').toString('utf8');
      const uname = decoded.split('-')[0].toLowerCase();
      const account = ADMIN_ACCOUNTS[uname] || ADMIN_ACCOUNTS.admin_anora;
      return res.json({
        success: true,
        user: {
          username: account.username,
          role: account.role,
          allowedStages: account.allowedStages,
          canBatchConfig: account.canBatchConfig
        }
      });
    } catch (e) {
      return res.json({
        success: true,
        user: {
          username: 'admin_anora',
          role: 'Super Administrator',
          allowedStages: ['assembly', 'ft', 'dlc', 'oqc', 'shipment'],
          canBatchConfig: true
        }
      });
    }
  }
  return res.status(401).json({ success: false, message: 'Invalid or expired session' });
});

// ==========================================
// PRODUCTION API ENDPOINTS
// ==========================================

// 1. Get full production state (called once on dashboard mount)
app.get('/api/production', (req, res) => {
  res.json({ success: true, data: buildFullState(productionState) });
});

// 1b. Get current batch count range
// GET /api/production/batch/range
// Response: { "start_count": 21101, "end_count": 21150 }
app.get('/api/production/batch/range', (req, res) => {
  const units = productionState.units || [];
  const startNum = units.length > 0 ? units[0].num : (productionState.startNum || 20001);
  const endNum = units.length > 0 ? units[units.length - 1].num : (startNum + (productionState.dailyTarget || 50) - 1);

  res.json({
    start_count: startNum,
    end_count: endNum
  });
});

// 2. Toggle a single unit's status at a given stage
// POST /api/production/unit/status
// Body: { serial: "PST21003", stage: "assembly", status: "done" | "pending" }
app.post('/api/production/unit/status', (req, res) => {
  const { serial, stage, status } = req.body;

  if (!serial || !stage || !status) {
    return res.status(400).json({
      success: false,
      message: 'Required fields: serial, stage, status'
    });
  }

  const allowedStages = ['assembly', 'ft', 'dlc', 'oqc', 'shipment'];
  if (!allowedStages.includes(stage)) {
    return res.status(400).json({
      success: false,
      message: `Invalid stage: '${stage}'. Allowed: ${allowedStages.join(', ')}`
    });
  }

  if (!['pending', 'done'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status: '${status}'. Allowed: 'pending', 'done'`
    });
  }

  const unitIndex = productionState.units.findIndex(u => u.serial === serial.trim().toUpperCase());
  if (unitIndex === -1) {
    return res.status(404).json({
      success: false,
      message: `Unit '${serial}' not found in current batch`
    });
  }

  const unit = productionState.units[unitIndex];

  // Validate cascading for marking as 'done'
  if (status === 'done' && !canEditUnitAtStage(unit, stage)) {
    const prevStage = getPrerequisiteStage(stage);
    return res.status(400).json({
      success: false,
      message: `Cannot mark ${serial} as done at ${stage.toUpperCase()}. ${prevStage} must be done first.`
    });
  }

  // If un-doing a stage, also undo all downstream stages (cascading un-do)
  if (status === 'pending') {
    if (stage === 'assembly') {
      unit.assembly = 'pending';
      unit.ft = 'pending';
      unit.dlc = 'pending';
      unit.oqc = 'pending';
      unit.shipment = 'pending';
    } else if (stage === 'ft') {
      unit.ft = 'pending';
      unit.dlc = 'pending';
      unit.oqc = 'pending';
      unit.shipment = 'pending';
    } else if (stage === 'dlc') {
      unit.dlc = 'pending';
      unit.oqc = 'pending';
      unit.shipment = 'pending';
    } else if (stage === 'oqc') {
      unit.oqc = 'pending';
      unit.shipment = 'pending';
    } else if (stage === 'shipment') {
      unit.shipment = 'pending';
    }
  } else {
    unit[stage] = 'done';
  }

  saveData();

  const fullState = buildFullState(productionState);
  io.emit('production_updated', fullState);

  res.json({
    success: true,
    message: `${serial} → ${stage.toUpperCase()}: ${status}`,
    unit,
    data: fullState
  });
});

// 2b. Batch update unit status by stage
// POST /api/production/stage/status
// Body: { stage: "assembly" | "ft" | "dlc" | "oqc" | "shipment", status: "done" | "pending", serials: ["PST21001", "PST21002"] }
app.post('/api/production/stage/status', async (req, res) => {
  const { stage, status, serials, autoCompletePrevious } = req.body;

  if (!stage || !status || !serials) {
    return res.status(400).json({
      success: false,
      message: 'Required fields: stage, status, serials'
    });
  }

  if (!Array.isArray(serials)) {
    return res.status(400).json({
      success: false,
      message: "'serials' must be an array of serial numbers"
    });
  }

  if (serials.length === 0) {
    return res.status(400).json({
      success: false,
      message: "'serials' array cannot be empty"
    });
  }

  const allowedStages = ['assembly', 'ft', 'dlc', 'oqc', 'shipment'];
  const stageKey = String(stage).trim().toLowerCase();
  if (!allowedStages.includes(stageKey)) {
    return res.status(400).json({
      success: false,
      message: `Invalid stage: '${stage}'. Allowed: ${allowedStages.join(', ')}`
    });
  }

  const statusVal = String(status).trim().toLowerCase();
  if (!['pending', 'done'].includes(statusVal)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status: '${status}'. Allowed: 'pending', 'done'`
    });
  }

  const stageIdx = allowedStages.indexOf(stageKey);
  const updated = [];
  const blocked = [];
  const notFound = [];
  const prefix = (productionState.prefix || 'PST').toUpperCase();

  // Deduplicate serial numbers in input while preserving order
  const uniqueSerials = [...new Set(serials.map(s => String(s).trim()))];

  for (const rawSerial of uniqueSerials) {
    const s = rawSerial.toUpperCase();
    const unit = productionState.units.find(u =>
      u.serial.toUpperCase() === s ||
      String(u.num) === s ||
      u.serial.toUpperCase() === `${prefix}${s}`
    );

    if (!unit) {
      notFound.push(rawSerial);
      continue;
    }

    if (statusVal === 'pending') {
      // Cascading un-do: reset this stage and all downstream stages
      for (let i = stageIdx; i < allowedStages.length; i++) {
        unit[allowedStages[i]] = 'pending';
      }
      updated.push(unit.serial);
    } else {
      // statusVal === 'done': Enforce cascading prerequisite (first assembly -> ft -> dlc -> oqc -> shipment)
      if (!autoCompletePrevious && !canEditUnitAtStage(unit, stageKey)) {
        blocked.push(unit.serial);
        continue;
      }

      if (autoCompletePrevious) {
        for (let i = 0; i <= stageIdx; i++) {
          unit[allowedStages[i]] = 'done';
        }
      } else {
        unit[stageKey] = 'done';
      }
      updated.push(unit.serial);
    }
  }

  if (updated.length === 0) {
    if (blocked.length > 0) {
      const prevStage = getPrerequisiteStage(stageKey);
      return res.status(400).json({
        success: false,
        message: `Cannot mark ${blocked.length} unit(s) as done at ${stageKey.toUpperCase()}. ${prevStage} must be done first.`,
        stage: stageKey,
        prerequisite_stage: prevStage,
        blocked_count: blocked.length,
        blocked,
        not_found_count: notFound.length,
        not_found: notFound
      });
    }

    return res.status(404).json({
      success: false,
      message: 'None of the provided serial numbers were found in current batch',
      not_found: notFound
    });
  }

  await saveData();

  const fullState = buildFullState(productionState);
  io.emit('production_updated', fullState);

  const prevStage = getPrerequisiteStage(stageKey);
  return res.json({
    success: true,
    message: `Updated ${updated.length} unit(s) at stage '${stageKey.toUpperCase()}' to '${statusVal}'${blocked.length > 0 ? ` (${blocked.length} blocked: ${prevStage} required first)` : ''}`,
    stage: stageKey,
    status: statusVal,
    updated_count: updated.length,
    updated,
    blocked_count: blocked.length,
    blocked,
    not_found_count: notFound.length,
    not_found: notFound,
    data: fullState
  });
});

// 3. Configure daily batch (super admin only)
// POST /api/production/configure
// Body: { startNum: 21001, dailyTarget: 50, prefix: "PST" }
app.post('/api/production/configure', (req, res) => {
  const { startNum, dailyTarget, prefix } = req.body;

  const newPrefix = (prefix || productionState.prefix || 'PST').trim().toUpperCase();
  const newStartNum = parseInt(startNum, 10);
  const newDailyTarget = parseInt(dailyTarget, 10);

  if (isNaN(newStartNum) || newStartNum < 1) {
    return res.status(400).json({
      success: false,
      message: 'startNum must be a positive integer'
    });
  }

  if (isNaN(newDailyTarget) || newDailyTarget < 1 || newDailyTarget > 500) {
    return res.status(400).json({
      success: false,
      message: 'dailyTarget must be between 1 and 500'
    });
  }

  // --- Overdue carry-over logic ---
  // Find units from the current batch that are NOT fully shipped
  const overdueUnits = (productionState.units || []).filter(u => {
    return u.shipment !== 'done'; // any unit not fully through the pipeline
  }).map(u => ({
    serial: u.serial,
    num: u.num,
    assembly: u.assembly,
    ft: u.ft,
    dlc: u.dlc,
    oqc: u.oqc,
    shipment: u.shipment,
    isOverdue: true // mark as overdue (from previous batch)
  }));

  // Generate new batch units
  const newUnits = generateUnits(newPrefix, newStartNum, newDailyTarget);

  // Merge: overdue units first, then new units
  const mergedUnits = [...overdueUnits, ...newUnits];

  const overdueCount = overdueUnits.length;
  console.log(`📦 Batch configured: ${overdueCount} overdue units carried over + ${newDailyTarget} new units = ${mergedUnits.length} total`);

  productionState.prefix = newPrefix;
  productionState.startNum = newStartNum;
  productionState.dailyTarget = newDailyTarget;
  productionState.units = mergedUnits;

  saveData();

  const fullState = buildFullState(productionState);
  io.emit('production_updated', fullState);

  res.json({
    success: true,
    message: `Batch configured: ${formatSerial(newPrefix, newStartNum)} → ${formatSerial(newPrefix, newStartNum + newDailyTarget - 1)} (${newDailyTarget} new + ${overdueCount} overdue = ${mergedUnits.length} total)`,
    data: fullState
  });
});

// Root health / API info endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Proteus Production Backend API',
    endpoints: {
      production: '/api/production',
      batchRange: '/api/production/batch/range',
      updateStatus: '/api/production/unit/status',
      configure: '/api/production/configure',
      authLogin: '/api/auth/login'
    }
  });
});

// ==========================================
// SOCKET.IO REAL-TIME
// ==========================================

io.on('connection', (socket) => {
  // Send initial state on connect
  socket.emit('initial_state', buildFullState(productionState));

  // Handle unit status toggle via WebSocket (fallback)
  socket.on('update_unit_status', ({ serial, stage, status }) => {
    if (!serial || !stage || !status) return;
    const allowedStages = ['assembly', 'ft', 'dlc', 'oqc', 'shipment'];
    if (!allowedStages.includes(stage)) return;
    if (!['pending', 'done'].includes(status)) return;

    const unit = productionState.units.find(u => u.serial === serial.trim().toUpperCase());
    if (!unit) return;

    if (status === 'done' && !canEditUnitAtStage(unit, stage)) return;

    if (status === 'pending') {
      if (stage === 'assembly') {
        unit.assembly = 'pending';
        unit.ft = 'pending';
        unit.dlc = 'pending';
        unit.oqc = 'pending';
        unit.shipment = 'pending';
      } else if (stage === 'ft') {
        unit.ft = 'pending';
        unit.dlc = 'pending';
        unit.oqc = 'pending';
        unit.shipment = 'pending';
      } else if (stage === 'dlc') {
        unit.dlc = 'pending';
        unit.oqc = 'pending';
        unit.shipment = 'pending';
      } else if (stage === 'oqc') {
        unit.oqc = 'pending';
        unit.shipment = 'pending';
      } else if (stage === 'shipment') {
        unit.shipment = 'pending';
      }
    } else {
      unit[stage] = 'done';
    }

    saveData();
    io.emit('production_updated', buildFullState(productionState));
  });

  // Handle shift update — always auto mode
  socket.on('set_shift', () => {
    productionState.shiftMode = 'auto';
    productionState.shift = getAutoShift();
    saveData();
    io.emit('production_updated', buildFullState(productionState));
  });
});

// ==========================================
// START SERVER
// ==========================================

server.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(` PROTEUS PRODUCTION TRACKER (5-STAGE CASCADE)       `);
  console.log(` Database:         ${DB_NAME}${isTestMode ? ' [TEST MODE]' : ''}`);
  console.log(` Backend API:      http://localhost:${PORT}`);
  console.log(` Production API:   http://localhost:${PORT}/api/production`);
  console.log(` Range API:        http://localhost:${PORT}/api/production/batch/range`);
  console.log(` Stage Status API: http://localhost:${PORT}/api/production/stage/status`);
  console.log(`====================================================`);
});
