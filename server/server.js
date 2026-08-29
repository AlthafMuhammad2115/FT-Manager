const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5000;
const DATA_FILE = path.join(__dirname, 'data', 'production_data.json');

// Ensure data folder exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

// Serial Number Helper Utilities
function parseSerial(serialStr) {
  if (!serialStr || typeof serialStr !== 'string') {
    return { prefix: 'PST', num: 20000, pad: 5, raw: 'PST20000' };
  }
  const match = serialStr.trim().match(/^([A-Za-z_-]*)(\d+)$/);
  if (match) {
    const prefix = match[1] || 'PST';
    const numStr = match[2];
    return {
      prefix,
      num: parseInt(numStr, 10),
      pad: numStr.length,
      raw: serialStr.trim()
    };
  }
  return { prefix: 'PST', num: 20000, pad: 5, raw: serialStr.trim() };
}

function formatSerial(prefix, num, pad = 5) {
  const numStr = String(Math.max(0, num)).padStart(pad, '0');
  return `${prefix}${numStr}`;
}

function calculateCount(startSerial, currentSerial) {
  const start = parseSerial(startSerial);
  const curr = parseSerial(currentSerial);
  if (curr.num >= start.num) {
    return (curr.num - start.num) + 1;
  }
  return 0;
}

function calculateTargetUnits(startSerial, targetSerial) {
  const start = parseSerial(startSerial);
  const tgt = parseSerial(targetSerial);
  if (tgt.num >= start.num) {
    return (tgt.num - start.num) + 1;
  }
  return 100;
}

// Shift Determination Helper (2 Active Shifts: 6am-2pm, 2pm-10pm)
function getAutoShift() {
  const now = new Date();
  const hours = now.getHours();
  if (hours >= 6 && hours < 14) {
    return 'Morning Shift (06:00 - 14:00)';
  } else if (hours >= 14 && hours < 22) {
    return 'Evening Shift (14:00 - 22:00)';
  } else {
    return 'Off-Shift (22:00 - 06:00)';
  }
}

// Initial state template with Serial Numbers
const defaultData = {
  productName: 'PROTEUS',
  shift: getAutoShift(),
  shiftMode: 'auto', // 'auto' | 'manual'
  lastUpdated: new Date().toISOString(),
  stages: {
    assembly: {
      id: 'assembly',
      name: 'Assembly',
      subtext: 'Mechanical & Sub-Assembly Build',
      startSerial: 'PST20001',
      currentSerial: 'PST20129',
      targetSerial: 'PST20200',
      targetCount: 200,
      currentCount: 129
    },
    ft: {
      id: 'ft',
      name: 'FT',
      fullName: 'Functional Testing',
      subtext: 'Automated QA & Electrical Diagnostics',
      startSerial: 'PST20001',
      currentSerial: 'PST20098',
      targetSerial: 'PST20200',
      targetCount: 200,
      currentCount: 98
    },
    dlc: {
      id: 'dlc',
      name: 'DLC',
      fullName: 'Device Life Cycle',
      subtext: 'Final Calibration & Burn-In',
      startSerial: 'PST20001',
      currentSerial: 'PST20082',
      targetSerial: 'PST20200',
      targetCount: 200,
      currentCount: 82
    }
  },
  logs: [
    {
      id: 'initial',
      timestamp: new Date().toISOString(),
      stage: 'system',
      message: 'Proteus Production Tracker initialized with Auto-Shift detection (6am-2pm / 2pm-10pm)'
    }
  ]
};

// Helper: Ensure backward compatibility & sync counts from serials
function normalizeStageData(stageObj) {
  if (!stageObj.startSerial) stageObj.startSerial = 'PST20001';
  if (!stageObj.currentSerial) {
    const startP = parseSerial(stageObj.startSerial);
    const count = typeof stageObj.current === 'number' ? stageObj.current : 0;
    stageObj.currentSerial = count > 0 ? formatSerial(startP.prefix, startP.num + count - 1, startP.pad) : stageObj.startSerial;
  }
  if (!stageObj.targetSerial) {
    const startP = parseSerial(stageObj.startSerial);
    const tgtCount = typeof stageObj.target === 'number' ? stageObj.target : 200;
    stageObj.targetSerial = formatSerial(startP.prefix, startP.num + tgtCount - 1, startP.pad);
  }

  stageObj.currentCount = calculateCount(stageObj.startSerial, stageObj.currentSerial);
  stageObj.targetCount = calculateTargetUnits(stageObj.startSerial, stageObj.targetSerial);
  stageObj.current = stageObj.currentCount;
  stageObj.target = stageObj.targetCount;
  return stageObj;
}

// Load data helper
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const loaded = JSON.parse(raw);
      if (loaded.stages) {
        Object.keys(loaded.stages).forEach(k => {
          loaded.stages[k] = normalizeStageData(loaded.stages[k]);
        });
      }
      
      // Auto-evaluate current shift on load if mode is auto or not set
      if (!loaded.shiftMode || loaded.shiftMode === 'auto') {
        loaded.shiftMode = 'auto';
        loaded.shift = getAutoShift();
      }

      return loaded;
    }
  } catch (err) {
    console.error('Error loading data file:', err);
  }
  saveData(defaultData);
  return defaultData;
}

// Save data helper
function saveData(data) {
  try {
    data.lastUpdated = new Date().toISOString();
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving data file:', err);
  }
}

let productionState = loadData();

// Background timer: Checks and updates shift automatically every 15 seconds
setInterval(() => {
  if (productionState.shiftMode !== 'manual') {
    const expectedShift = getAutoShift();
    if (productionState.shift !== expectedShift) {
      console.log(`[Shift Auto-Transition] Switching shift from "${productionState.shift}" to "${expectedShift}". Increasing target by 20.`);
      const oldShift = productionState.shift;
      productionState.shift = expectedShift;
      
      // Auto-increment target by 20 at each shift change
      if (productionState.stages) {
        Object.keys(productionState.stages).forEach(stageKey => {
          const st = productionState.stages[stageKey];
          const tgtP = parseSerial(st.targetSerial);
          const newTargetNum = tgtP.num + 20;
          st.targetSerial = formatSerial(tgtP.prefix, newTargetNum, tgtP.pad);
          normalizeStageData(st);
        });
      }

      const logEntry = {
        id: 'shift-' + Date.now(),
        timestamp: new Date().toISOString(),
        stage: 'system',
        stageName: 'Shift Scheduler',
        message: `Shift changed to ${expectedShift}: Target Proteus increased by +20 units on all stages`,
        operator: 'Auto Shift Engine'
      };
      productionState.logs.unshift(logEntry);
      if (productionState.logs.length > 50) productionState.logs = productionState.logs.slice(0, 50);
      
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

// Authentication Config & Endpoints
const ADMIN_CREDENTIALS = {
  username: process.env.ADMIN_USERNAME || 'admin_user',
  passwords: [process.env.ADMIN_PASSWORD || 'admin_pass', 'admin_pass']
};

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required' });
  }

  const validUsername = username.trim().toLowerCase() === ADMIN_CREDENTIALS.username.toLowerCase();
  const validPassword = ADMIN_CREDENTIALS.passwords.includes(password.trim());

  if (validUsername && validPassword) {
    const token = 'token-' + Buffer.from(`${username}-${Date.now()}`).toString('base64');
    
    // Log admin login event
    const logEntry = {
      id: 'auth-' + Date.now(),
      timestamp: new Date().toISOString(),
      stage: 'system',
      stageName: 'Security',
      message: `Admin user '${username}' authenticated successfully`,
      operator: username
    };
    productionState.logs.unshift(logEntry);
    if (productionState.logs.length > 50) productionState.logs = productionState.logs.slice(0, 50);
    saveData(productionState);

    return res.json({
      success: true,
      token,
      user: {
        username: username.trim(),
        role: 'Supervisor / Administrator',
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
    return res.json({
      success: true,
      user: {
        username: 'admin',
        role: 'Supervisor / Administrator'
      }
    });
  }
  return res.status(401).json({ success: false, message: 'Invalid or expired session' });
});

// API Routes
app.get('/api/production', (req, res) => {
  res.json({ success: true, data: productionState });
});

// Update specific stage serials, counts, or delta
app.post('/api/production/update', (req, res) => {
  const { stage, currentSerial, targetSerial, startSerial, delta, shift, operator } = req.body;

  if (shift) {
    // Always force auto shift — determined by system time only
    productionState.shiftMode = 'auto';
    productionState.shift = getAutoShift();
  }

  if (stage && productionState.stages[stage]) {
    const stageObj = productionState.stages[stage];
    
    if (startSerial) {
      stageObj.startSerial = startSerial.trim().toUpperCase();
    }

    if (currentSerial) {
      stageObj.currentSerial = currentSerial.trim().toUpperCase();
    } else if (typeof delta === 'number') {
      const currP = parseSerial(stageObj.currentSerial);
      const newNum = Math.max(0, currP.num + delta);
      stageObj.currentSerial = formatSerial(currP.prefix, newNum, currP.pad);
    }

    if (targetSerial) {
      stageObj.targetSerial = targetSerial.trim().toUpperCase();
    }

    // Sync calculated counts
    normalizeStageData(stageObj);

    // Add log
    const logEntry = {
      id: 'log-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      timestamp: new Date().toISOString(),
      stage: stage,
      stageName: stageObj.name,
      currentSerial: stageObj.currentSerial,
      targetSerial: stageObj.targetSerial,
      currentCount: stageObj.currentCount,
      targetCount: stageObj.targetCount,
      delta: delta || 0,
      operator: operator || 'Station Admin'
    };

    productionState.logs.unshift(logEntry);
    if (productionState.logs.length > 50) {
      productionState.logs = productionState.logs.slice(0, 50);
    }
  }

  saveData(productionState);
  io.emit('production_updated', productionState);

  res.json({ success: true, data: productionState });
});

// Batch update all stages
app.post('/api/production/batch', (req, res) => {
  const { stages, shift, operator } = req.body;
  if (shift) productionState.shift = shift;

  if (stages) {
    ['assembly', 'ft', 'dlc'].forEach((sKey) => {
      if (stages[sKey] && productionState.stages[sKey]) {
        const s = stages[sKey];
        if (s.startSerial) productionState.stages[sKey].startSerial = s.startSerial.trim().toUpperCase();
        if (s.currentSerial) productionState.stages[sKey].currentSerial = s.currentSerial.trim().toUpperCase();
        if (s.targetSerial) productionState.stages[sKey].targetSerial = s.targetSerial.trim().toUpperCase();
        normalizeStageData(productionState.stages[sKey]);
      }
    });

    const logEntry = {
      id: 'log-' + Date.now(),
      timestamp: new Date().toISOString(),
      stage: 'all',
      message: 'Batch updated stage serials & targets',
      operator: operator || 'Admin Panel'
    };
    productionState.logs.unshift(logEntry);
    if (productionState.logs.length > 50) productionState.logs = productionState.logs.slice(0, 50);
  }

  saveData(productionState);
  io.emit('production_updated', productionState);
  res.json({ success: true, data: productionState });
});

// Reset count / serials (for new shift or next batch)
app.post('/api/production/reset', (req, res) => {
  const { mode, stage, newStartSerial, newTargetSerial, newShift, operator } = req.body;

  if (newShift) {
    productionState.shift = newShift;
  }

  if (mode === 'next_batch' && newStartSerial && newTargetSerial) {
    Object.keys(productionState.stages).forEach(key => {
      productionState.stages[key].startSerial = newStartSerial.trim().toUpperCase();
      productionState.stages[key].currentSerial = newStartSerial.trim().toUpperCase();
      productionState.stages[key].targetSerial = newTargetSerial.trim().toUpperCase();
      normalizeStageData(productionState.stages[key]);
    });
  } else if (mode === 'all_counts') {
    Object.keys(productionState.stages).forEach(key => {
      const s = productionState.stages[key];
      s.currentSerial = s.startSerial;
      normalizeStageData(s);
    });
  } else if (mode === 'single_stage' && stage && productionState.stages[stage]) {
    const s = productionState.stages[stage];
    s.currentSerial = s.startSerial;
    normalizeStageData(s);
  }

  const logEntry = {
    id: 'log-' + Date.now(),
    timestamp: new Date().toISOString(),
    stage: stage || 'system',
    message: `Reset/Batch change executed (Mode: ${mode || 'all_counts'})`,
    operator: operator || 'Admin'
  };
  productionState.logs.unshift(logEntry);
  if (productionState.logs.length > 50) productionState.logs = productionState.logs.slice(0, 50);

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
  socket.on('increment_count', ({ stage, delta, operator }) => {
    if (stage && productionState.stages[stage]) {
      const stageObj = productionState.stages[stage];
      const diff = delta || 1;
      const currP = parseSerial(stageObj.currentSerial);
      const newNum = Math.max(0, currP.num + diff);
      stageObj.currentSerial = formatSerial(currP.prefix, newNum, currP.pad);
      normalizeStageData(stageObj);
      
      const logEntry = {
        id: 'log-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        timestamp: new Date().toISOString(),
        stage: stage,
        stageName: stageObj.name,
        currentSerial: stageObj.currentSerial,
        targetSerial: stageObj.targetSerial,
        currentCount: stageObj.currentCount,
        targetCount: stageObj.targetCount,
        delta: diff,
        operator: operator || 'Station Quick-Tap'
      };
      productionState.logs.unshift(logEntry);
      if (productionState.logs.length > 50) productionState.logs = productionState.logs.slice(0, 50);

      saveData(productionState);
      io.emit('production_updated', productionState);
      io.emit('stage_pulse', { stage, delta: diff, currentSerial: stageObj.currentSerial, currentCount: stageObj.currentCount });
    }
  });

  // Handle direct serial number scan / set
  socket.on('set_stage_serial', ({ stage, currentSerial, targetSerial, startSerial, operator }) => {
    if (stage && productionState.stages[stage]) {
      const stageObj = productionState.stages[stage];
      if (startSerial) stageObj.startSerial = startSerial.trim().toUpperCase();
      if (currentSerial) stageObj.currentSerial = currentSerial.trim().toUpperCase();
      if (targetSerial) stageObj.targetSerial = targetSerial.trim().toUpperCase();
      normalizeStageData(stageObj);

      const logEntry = {
        id: 'log-' + Date.now(),
        timestamp: new Date().toISOString(),
        stage: stage,
        stageName: stageObj.name,
        currentSerial: stageObj.currentSerial,
        targetSerial: stageObj.targetSerial,
        currentCount: stageObj.currentCount,
        targetCount: stageObj.targetCount,
        operator: operator || 'Admin / Barcode Scanner'
      };
      productionState.logs.unshift(logEntry);
      if (productionState.logs.length > 50) productionState.logs = productionState.logs.slice(0, 50);

      saveData(productionState);
      io.emit('production_updated', productionState);
      io.emit('stage_pulse', { stage, currentSerial: stageObj.currentSerial, currentCount: stageObj.currentCount });
    }
  });

  // Handle shift update — always auto mode, manual shift changes are rejected
  socket.on('set_shift', ({ shift, mode }) => {
    // Always force auto shift — shift is determined by system time only
    productionState.shiftMode = 'auto';
    productionState.shift = getAutoShift();
    saveData(productionState);
    io.emit('production_updated', productionState);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(` PROTEUS PRODUCTION TRACKER (SERIAL NUMBER ENGINE) `);
  console.log(` Local:            http://localhost:${PORT}`);
  console.log(` TV Display View:  http://localhost:${PORT}`);
  console.log(` Admin Panel View: http://localhost:${PORT}/#admin`);
  console.log(`====================================================`);
});
