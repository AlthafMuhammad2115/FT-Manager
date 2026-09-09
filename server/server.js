require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
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

// Serial Number Helper Utilities
function parseSerial(serialStr) {
  if (!serialStr || typeof serialStr !== 'string') {
    return { prefix: 'PST', num: 20000, pad: 5, raw: '' };
  }
  const match = serialStr.trim().match(/^([A-Za-z_-]*)(\d+)$/);
  if (match) {
    const prefix = match[1] || 'PST';
    const numStr = match[2];
    return {
      prefix,
      num: parseInt(numStr, 10),
      pad: Math.max(numStr.length, 5),
      raw: serialStr.trim()
    };
  }
  return { prefix: 'PST', num: 20000, pad: 5, raw: serialStr.trim() };
}

function formatSerial(prefix, num, pad = 5) {
  const numStr = String(Math.max(0, num)).padStart(pad, '0');
  return `${prefix}${numStr}`;
}

// Automatically deduce starting serial from current/target serial if startSerial is not given
function getEffectiveStartSerial(startSerial, currentSerial, targetSerial) {
  if (startSerial && typeof startSerial === 'string' && startSerial.trim().length > 0) {
    return startSerial.trim().toUpperCase();
  }
  const ref = currentSerial || targetSerial || 'PST20001';
  const parsed = parseSerial(ref);
  if (parsed.num >= 20000) {
    return formatSerial(parsed.prefix, 20001, parsed.pad);
  } else if (parsed.num > 0) {
    return formatSerial(parsed.prefix, 1, parsed.pad);
  }
  return 'PST20001';
}

function calculateCount(startSerial, currentSerial) {
  if (!currentSerial) return 0;
  const start = parseSerial(startSerial || 'PST20001');
  const curr = parseSerial(currentSerial);
  if (curr.num >= start.num && start.num > 0) {
    return (curr.num - start.num) + 1;
  }
  return 0;
}

function calculateTargetUnits(startSerial, targetSerial) {
  if (!targetSerial) return 0;
  const start = parseSerial(startSerial || 'PST20001');
  const tgt = parseSerial(targetSerial);
  if (tgt.num >= start.num && start.num > 0) {
    return (tgt.num - start.num) + 1;
  }
  return 0;
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

// Initial state template — starts blank so data is set directly from frontend
const defaultData = {
  productName: 'PROTEUS',
  shift: getAutoShift(),
  shiftMode: 'auto',
  lastUpdated: new Date().toISOString(),
  stages: {
    assembly: {
      id: 'assembly',
      name: 'Assembly',
      subtext: 'Mechanical & Sub-Assembly Build',
      startSerial: 'PST20001',
      currentSerial: '',
      targetSerial: '',
      targetCount: 0,
      currentCount: 0,
      current: 0,
      target: 0
    },
    ft: {
      id: 'ft',
      name: 'FT',
      fullName: 'Functional Testing',
      subtext: 'Automated QA & Electrical Diagnostics',
      startSerial: 'PST20001',
      currentSerial: '',
      targetSerial: '',
      targetCount: 0,
      currentCount: 0,
      current: 0,
      target: 0
    },
    dlc: {
      id: 'dlc',
      name: 'DLC',
      fullName: 'Device Life Cycle',
      subtext: 'Final Calibration & Burn-In',
      startSerial: 'PST20001',
      currentSerial: '',
      targetSerial: '',
      targetCount: 0,
      currentCount: 0,
      current: 0,
      target: 0
    }
  }
};

// Helper: Ensure counts are accurately synchronized from serials
function normalizeStageData(stageObj) {
  if (!stageObj) return stageObj;

  stageObj.currentSerial = stageObj.currentSerial ? stageObj.currentSerial.trim().toUpperCase() : '';
  stageObj.targetSerial = stageObj.targetSerial ? stageObj.targetSerial.trim().toUpperCase() : '';
  stageObj.startSerial = getEffectiveStartSerial(stageObj.startSerial, stageObj.currentSerial, stageObj.targetSerial);

  if (stageObj.currentSerial) {
    stageObj.currentCount = calculateCount(stageObj.startSerial, stageObj.currentSerial);
  } else {
    stageObj.currentCount = typeof stageObj.current === 'number' ? stageObj.current : 0;
  }

  if (stageObj.targetSerial) {
    stageObj.targetCount = calculateTargetUnits(stageObj.startSerial, stageObj.targetSerial);
  } else {
    stageObj.targetCount = typeof stageObj.target === 'number' ? stageObj.target : 0;
  }

  stageObj.current = stageObj.currentCount;
  stageObj.target = stageObj.targetCount;
  return stageObj;
}

// Cascade Pipeline: Assembly Current ➔ FT Target, FT Current ➔ DLC Target
function applyStageCascade(stages) {
  if (!stages) return stages;

  // 1. Normalize Assembly Stage
  if (stages.assembly) {
    normalizeStageData(stages.assembly);
  }

  // 2. Cascade Assembly Current ➔ FT Target
  if (stages.ft) {
    if (stages.assembly) {
      if (stages.assembly.currentSerial) {
        stages.ft.targetSerial = stages.assembly.currentSerial;
      }
      if (stages.assembly.startSerial) {
        stages.ft.startSerial = stages.assembly.startSerial;
      }
    }
    normalizeStageData(stages.ft);
  }

  // 3. Cascade FT Current ➔ DLC Target
  if (stages.dlc) {
    if (stages.ft) {
      if (stages.ft.currentSerial) {
        stages.dlc.targetSerial = stages.ft.currentSerial;
      }
      if (stages.ft.startSerial) {
        stages.dlc.startSerial = stages.ft.startSerial;
      }
    }
    normalizeStageData(stages.dlc);
  }

  return stages;
}

// In-Memory state clone of defaultData
let productionState = JSON.parse(JSON.stringify(defaultData));

// Save data helper (persists directly to MongoDB)
async function saveData(data) {
  try {
    data.lastUpdated = new Date().toISOString();
    if (mongoose.connection.readyState === 1) {
      await ProductionModel.findOneAndUpdate(
        { key: 'current_production_state' },
        {
          $set: {
            key: 'current_production_state',
            productName: data.productName,
            shift: data.shift,
            shiftMode: data.shiftMode,
            lastUpdated: data.lastUpdated,
            stages: data.stages
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      console.log('✅ MongoDB Synced:', new Date().toLocaleTimeString());
    } else {
      console.warn('⚠️ MongoDB not connected yet (readyState:', mongoose.connection.readyState, ')');
    }
  } catch (err) {
    console.error('❌ MongoDB save error:', err.message);
  }
}

// MongoDB Initialization and State Synchronization
async function initMongoDB() {
  if (!MONGODB_URI) {
    console.warn('⚠️  MONGODB_URI is not set in .env! Please configure MONGODB_URI to persist production state.');
    return;
  }

  try {
    console.log('🔄 Connecting to MongoDB database...');
    await mongoose.connect(MONGODB_URI, { dbName: 'ft_manager' });
    console.log('✅ Connected to MongoDB successfully! Database: ft_manager');

    // Fetch existing state from MongoDB
    const existingDoc = await ProductionModel.findOne({ key: 'current_production_state' }).lean();
    if (existingDoc && existingDoc.stages && Object.keys(existingDoc.stages).length > 0) {
      console.log('📥 Loaded production state from MongoDB.');
      productionState = {
        productName: existingDoc.productName || 'PROTEUS',
        shift: (existingDoc.shiftMode === 'manual' && existingDoc.shift) ? existingDoc.shift : getAutoShift(),
        shiftMode: existingDoc.shiftMode || 'auto',
        lastUpdated: existingDoc.lastUpdated || new Date().toISOString(),
        stages: existingDoc.stages
      };
      
      applyStageCascade(productionState.stages);

      io.emit('production_updated', productionState);
    } else {
      console.log('📤 Initializing fresh production state in MongoDB collection...');
      applyStageCascade(productionState.stages);
      await ProductionModel.findOneAndUpdate(
        { key: 'current_production_state' },
        {
          key: 'current_production_state',
          productName: productionState.productName,
          shift: productionState.shift,
          shiftMode: productionState.shiftMode,
          lastUpdated: productionState.lastUpdated,
          stages: productionState.stages
        },
        { upsert: true, new: true }
      );
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
      const oldShift = productionState.shift;
      productionState.shift = expectedShift;
      
      // Target count increases by +20 only after Morning Shift (6am-2pm) or Evening Shift (2pm-10pm) completes
      const isMorningCompleted = oldShift && oldShift.includes('Morning Shift');
      const isEveningCompleted = oldShift && oldShift.includes('Evening Shift');
      const shouldIncrementTarget = isMorningCompleted || isEveningCompleted;

      if (shouldIncrementTarget && productionState.stages) {
        console.log(`[Shift Completion] ${oldShift} completed ➔ Transitioning to ${expectedShift}. Increasing target by +20 units.`);
        const st = productionState.stages.assembly;
        if (st && st.targetSerial) {
          const tgtP = parseSerial(st.targetSerial);
          const newTargetNum = tgtP.num + 20;
          st.targetSerial = formatSerial(tgtP.prefix, newTargetNum, tgtP.pad);
        }
        applyStageCascade(productionState.stages);
      } else {
        console.log(`[Shift Transition] Shift changed from "${oldShift}" to "${expectedShift}".`);
      }
      
      saveData(productionState);
      io.emit('production_updated', productionState);
      io.emit('shift_changed', { shift: expectedShift });
    }
  }
}, 15000);

app.use(cors());
app.use(express.json());

// Serve production build of client if exists
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
}

// Authentication Accounts & Roles Configuration
const ADMIN_ACCOUNTS = {
  admin_anora: {
    username: 'admin_anora',
    passwords: ['Anora@12#'],
    role: 'Super Administrator',
    allowedStages: ['assembly', 'ft', 'dlc'],
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
  // Backwards compatibility
  admin_user: {
    username: 'admin_user',
    passwords: ['admin_pass'],
    role: 'Administrator',
    allowedStages: ['assembly', 'ft', 'dlc'],
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
          allowedStages: ['assembly', 'ft', 'dlc'],
          canBatchConfig: true
        }
      });
    }
  }
  return res.status(401).json({ success: false, message: 'Invalid or expired session' });
});

// ==========================================
// DEDICATED PRODUCTION REST API ENDPOINTS
// ==========================================

// 1. Get Live Production Status
app.get('/api/production', (req, res) => {
  res.json({ success: true, data: productionState });
});

// 2. Increment Current Count for a Specific Stage (/api/production/assembly/increment, /api/production/ft/increment, /api/production/dlc/increment)
app.all(['/api/production/:stage/increment', '/api/production/increment/:stage'], (req, res) => {
  const stage = (req.params.stage || '').toLowerCase();
  if (!['assembly', 'ft', 'dlc'].includes(stage)) {
    return res.status(400).json({
      success: false,
      message: `Invalid stage: '${stage}'. Allowed stages: 'assembly', 'ft', 'dlc'`
    });
  }

  const delta = parseInt(req.body?.delta ?? req.query?.delta ?? 1, 10) || 1;
  const directSerial = req.body?.serial || req.body?.currentSerial || req.query?.serial;
  const stageObj = productionState.stages[stage];

  if (directSerial) {
    stageObj.currentSerial = directSerial.trim().toUpperCase();
  } else {
    const currP = parseSerial(stageObj.currentSerial || stageObj.startSerial || 'PST20001');
    const newNum = Math.max(0, currP.num + delta);
    stageObj.currentSerial = formatSerial(currP.prefix, newNum, currP.pad);
  }

  applyStageCascade(productionState.stages);
  saveData(productionState);

  io.emit('production_updated', productionState);
  io.emit('stage_pulse', {
    stage,
    delta,
    currentSerial: stageObj.currentSerial,
    currentCount: stageObj.currentCount
  });

  res.json({
    success: true,
    message: `${stage.toUpperCase()} incremented by ${delta > 0 ? '+' : ''}${delta} ➔ Current: ${stageObj.currentSerial} (${stageObj.currentCount} units)`,
    stage: stageObj,
    data: productionState
  });
});

// 2b. Set / Save Specific Stage Serials and Target (/api/production/assembly/save, /api/production/assembly/set, /api/production/ft/save, etc.)
app.all(['/api/production/:stage/set', '/api/production/:stage/save', '/api/production/set/:stage', '/api/production/save/:stage'], (req, res) => {
  const stage = (req.params.stage || '').toLowerCase();
  if (!['assembly', 'ft', 'dlc'].includes(stage)) {
    return res.status(400).json({
      success: false,
      message: `Invalid stage: '${stage}'. Allowed stages: 'assembly', 'ft', 'dlc'`
    });
  }

  const { currentSerial, targetSerial, startSerial } = req.body;
  const stageObj = productionState.stages[stage];

  if (startSerial !== undefined) {
    stageObj.startSerial = startSerial ? startSerial.trim().toUpperCase() : '';
  }
  if (currentSerial !== undefined) {
    stageObj.currentSerial = currentSerial ? currentSerial.trim().toUpperCase() : '';
  }
  if (targetSerial !== undefined) {
    stageObj.targetSerial = targetSerial ? targetSerial.trim().toUpperCase() : '';
  }

  applyStageCascade(productionState.stages);
  saveData(productionState);

  io.emit('production_updated', productionState);
  io.emit('stage_pulse', {
    stage,
    currentSerial: stageObj.currentSerial,
    currentCount: stageObj.currentCount
  });

  res.json({
    success: true,
    message: `Saved ${stage.toUpperCase()} Proteus: ${stageObj.currentSerial} (Target: ${stageObj.targetSerial})`,
    stage: stageObj,
    data: productionState
  });
});

// 3. Set Current Serial or Count directly (/api/production/assembly/current, /api/production/ft/current, /api/production/dlc/current)
app.all(['/api/production/:stage/current', '/api/production/current/:stage'], (req, res) => {
  const stage = (req.params.stage || '').toLowerCase();
  if (!['assembly', 'ft', 'dlc'].includes(stage)) {
    return res.status(400).json({
      success: false,
      message: `Invalid stage: '${stage}'. Allowed stages: 'assembly', 'ft', 'dlc'`
    });
  }

  const currentSerial = req.body?.currentSerial || req.body?.serial || req.query?.currentSerial || req.query?.serial;
  const count = req.body?.count ?? req.query?.count;
  const stageObj = productionState.stages[stage];

  if (currentSerial) {
    stageObj.currentSerial = currentSerial.trim().toUpperCase();
  } else if (typeof count === 'number' || !isNaN(parseInt(count, 10))) {
    const countNum = parseInt(count, 10);
    const startP = parseSerial(stageObj.startSerial || 'PST20001');
    const newNum = countNum > 0 ? startP.num + countNum - 1 : startP.num;
    stageObj.currentSerial = formatSerial(startP.prefix, newNum, startP.pad);
  } else {
    return res.status(400).json({
      success: false,
      message: 'Please provide currentSerial (e.g. "PST20050") or count (e.g. 50)'
    });
  }

  applyStageCascade(productionState.stages);
  saveData(productionState);

  io.emit('production_updated', productionState);
  io.emit('stage_pulse', {
    stage,
    currentSerial: stageObj.currentSerial,
    currentCount: stageObj.currentCount
  });

  res.json({
    success: true,
    message: `${stage.toUpperCase()} Current updated ➔ ${stageObj.currentSerial} (${stageObj.currentCount} units)`,
    stage: stageObj,
    data: productionState
  });
});

// 4. Set Assembly Target (or any stage target) directly
// POST /api/production/assembly/target (Body: { targetSerial: 'PST20500' } or { targetCount: 500 } or { target: 500 })
app.all(['/api/production/assembly/target', '/api/production/target/assembly', '/api/production/target', '/api/production/:stage/target'], (req, res) => {
  const stage = (req.params?.stage || req.body?.stage || 'assembly').toLowerCase();
  const targetSerial = req.body?.targetSerial || req.body?.target || req.query?.targetSerial;
  const targetCount = req.body?.targetCount ?? req.query?.targetCount;

  const stageObj = productionState.stages[stage] || productionState.stages.assembly;

  if (targetSerial && typeof targetSerial === 'string' && isNaN(targetSerial)) {
    stageObj.targetSerial = targetSerial.trim().toUpperCase();
  } else if (typeof (targetCount ?? targetSerial) === 'number' || !isNaN(parseInt(targetCount ?? targetSerial, 10))) {
    const tgtUnits = parseInt(targetCount ?? targetSerial, 10);
    const startP = parseSerial(stageObj.startSerial || 'PST20001');
    const newNum = tgtUnits > 0 ? startP.num + tgtUnits - 1 : startP.num;
    stageObj.targetSerial = formatSerial(startP.prefix, newNum, startP.pad);
  } else {
    return res.status(400).json({
      success: false,
      message: 'Please provide targetSerial (e.g. "PST20500") or targetCount (e.g. 500)'
    });
  }

  applyStageCascade(productionState.stages);
  saveData(productionState);

  io.emit('production_updated', productionState);

  res.json({
    success: true,
    message: `${stage.toUpperCase()} Target updated ➔ ${stageObj.targetSerial} (${stageObj.targetCount} units)`,
    stage: stageObj,
    data: productionState
  });
});

// 5. Generic / Legacy update route
app.post('/api/production/update', (req, res) => {
  const { stage, currentSerial, targetSerial, startSerial, delta, shift } = req.body;

  if (shift) {
    // Always force auto shift — determined by system time only
    productionState.shiftMode = 'auto';
    productionState.shift = getAutoShift();
  }

  if (stage && productionState.stages[stage]) {
    const stageObj = productionState.stages[stage];
    
    if (startSerial !== undefined) {
      stageObj.startSerial = startSerial ? startSerial.trim().toUpperCase() : '';
    }

    if (currentSerial !== undefined) {
      stageObj.currentSerial = currentSerial ? currentSerial.trim().toUpperCase() : '';
    } else if (typeof delta === 'number') {
      const currP = parseSerial(stageObj.currentSerial);
      const newNum = Math.max(0, currP.num + delta);
      stageObj.currentSerial = formatSerial(currP.prefix, newNum, currP.pad);
    }

    if (targetSerial !== undefined) {
      stageObj.targetSerial = targetSerial ? targetSerial.trim().toUpperCase() : '';
    }

    // Apply cascade propagation
    applyStageCascade(productionState.stages);
  }

  saveData(productionState);
  io.emit('production_updated', productionState);

  res.json({ success: true, data: productionState });
});

// Batch update all stages
app.post('/api/production/batch', (req, res) => {
  const { stages, shift } = req.body;
  if (shift) productionState.shift = shift;

  if (stages) {
    ['assembly', 'ft', 'dlc'].forEach((sKey) => {
      if (stages[sKey] && productionState.stages[sKey]) {
        const s = stages[sKey];
        if (s.startSerial !== undefined) productionState.stages[sKey].startSerial = s.startSerial ? s.startSerial.trim().toUpperCase() : '';
        if (s.currentSerial !== undefined) productionState.stages[sKey].currentSerial = s.currentSerial ? s.currentSerial.trim().toUpperCase() : '';
        if (s.targetSerial !== undefined) productionState.stages[sKey].targetSerial = s.targetSerial ? s.targetSerial.trim().toUpperCase() : '';
      }
    });
    applyStageCascade(productionState.stages);
  }

  saveData(productionState);
  io.emit('production_updated', productionState);
  res.json({ success: true, data: productionState });
});

// Reset count / serials (for new shift or next batch)
app.post('/api/production/reset', (req, res) => {
  const { mode, stage, newStartSerial, newTargetSerial, newShift } = req.body;

  if (newShift) {
    productionState.shift = newShift;
  }

  if (mode === 'next_batch' && newStartSerial && newTargetSerial) {
    if (productionState.stages.assembly) {
      productionState.stages.assembly.startSerial = newStartSerial.trim().toUpperCase();
      productionState.stages.assembly.currentSerial = newStartSerial.trim().toUpperCase();
      productionState.stages.assembly.targetSerial = newTargetSerial.trim().toUpperCase();
    }
    if (productionState.stages.ft) {
      productionState.stages.ft.startSerial = newStartSerial.trim().toUpperCase();
      productionState.stages.ft.currentSerial = newStartSerial.trim().toUpperCase();
    }
    if (productionState.stages.dlc) {
      productionState.stages.dlc.startSerial = newStartSerial.trim().toUpperCase();
      productionState.stages.dlc.currentSerial = newStartSerial.trim().toUpperCase();
    }
    applyStageCascade(productionState.stages);
  } else if (mode === 'all_counts') {
    Object.keys(productionState.stages).forEach(key => {
      const s = productionState.stages[key];
      s.currentSerial = s.startSerial;
    });
    applyStageCascade(productionState.stages);
  } else if (mode === 'single_stage' && stage && productionState.stages[stage]) {
    const s = productionState.stages[stage];
    s.currentSerial = s.startSerial;
    applyStageCascade(productionState.stages);
  }

  saveData(productionState);
  io.emit('production_updated', productionState);
  res.json({ success: true, data: productionState });
});

// Catch-all for React SPA routing
app.get('*', (req, res) => {
  const indexPath = path.join(clientDist, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({ message: 'Proteus Production Backend Running', status: 'OK' });
  }
});

// Socket.io Real-Time connection handling
io.on('connection', (socket) => {
  // Send initial state
  socket.emit('initial_state', productionState);

  // Handle client increment event (+1, +5, etc)
  socket.on('increment_count', ({ stage, delta }) => {
    if (stage && productionState.stages[stage]) {
      const stageObj = productionState.stages[stage];
      const diff = delta || 1;
      const currP = parseSerial(stageObj.currentSerial);
      const newNum = Math.max(0, currP.num + diff);
      stageObj.currentSerial = formatSerial(currP.prefix, newNum, currP.pad);
      applyStageCascade(productionState.stages);

      saveData(productionState);
      io.emit('production_updated', productionState);
      io.emit('stage_pulse', { stage, delta: diff, currentSerial: stageObj.currentSerial, currentCount: stageObj.currentCount });
    }
  });

  // Handle direct serial number scan / set
  socket.on('set_stage_serial', ({ stage, currentSerial, targetSerial, startSerial }) => {
    if (stage && productionState.stages[stage]) {
      const stageObj = productionState.stages[stage];
      if (startSerial !== undefined) stageObj.startSerial = startSerial ? startSerial.trim().toUpperCase() : '';
      if (currentSerial !== undefined) stageObj.currentSerial = currentSerial ? currentSerial.trim().toUpperCase() : '';
      if (targetSerial !== undefined) stageObj.targetSerial = targetSerial ? targetSerial.trim().toUpperCase() : '';
      applyStageCascade(productionState.stages);

      saveData(productionState);
      io.emit('production_updated', productionState);
      io.emit('stage_pulse', { stage, currentSerial: stageObj.currentSerial, currentCount: stageObj.currentCount });
    }
  });

  // Handle shift update — always auto mode
  socket.on('set_shift', () => {
    productionState.shiftMode = 'auto';
    productionState.shift = getAutoShift();
    saveData(productionState);
    io.emit('production_updated', productionState);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(` PROTEUS PRODUCTION TRACKER (MONGODB CLOUD ENGINE) `);
  console.log(` Local:            http://localhost:${PORT}`);
  console.log(` TV Display View:  http://localhost:${PORT}`);
  console.log(` Admin Panel View: http://localhost:${PORT}/#admin`);
  console.log(`====================================================`);
});
