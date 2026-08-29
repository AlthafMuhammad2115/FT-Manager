import React, { useState, useMemo, useEffect } from 'react';
import { useProduction } from '../context/ProductionContext';
import { 
  ArrowLeft, 
  RotateCcw, 
  Save, 
  Layers, 
  Activity, 
  ShieldCheck, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  QrCode,
  ScanLine,
  ChevronRight,
  Lock
} from 'lucide-react';

// Auto shift detection (mirrors server logic — not editable)
function getAutoShift() {
  const hours = new Date().getHours();
  if (hours >= 6 && hours < 14) {
    return 'Morning Shift (06:00 - 14:00)';
  } else if (hours >= 14 && hours < 22) {
    return 'Evening Shift (14:00 - 22:00)';
  } else {
    return 'Off-Shift (22:00 - 06:00)';
  }
}

export const AdminPanel = ({ adminUser, onBackToDashboard, onLogout }) => {
  const { data, incrementCount, setStageSerial, resetProduction } = useProduction();
  const stages = data.stages || {};

  // Form states for manual serial entries
  const [serialInputs, setSerialInputs] = useState({
    assembly: {
      currentSerial: stages.assembly?.currentSerial || 'PST20129',
      targetSerial: stages.assembly?.targetSerial || 'PST20200',
    },
    ft: {
      currentSerial: stages.ft?.currentSerial || 'PST20098',
      targetSerial: stages.ft?.targetSerial || 'PST20200',
    },
    dlc: {
      currentSerial: stages.dlc?.currentSerial || 'PST20082',
      targetSerial: stages.dlc?.targetSerial || 'PST20200',
    },
  });

  // Keep input fields synchronized whenever live stage serials update (via +1, +5, -1 buttons, scans, or sync)
  useEffect(() => {
    if (data && data.stages) {
      setSerialInputs({
        assembly: {
          currentSerial: data.stages.assembly?.currentSerial || '',
          targetSerial: data.stages.assembly?.targetSerial || '',
        },
        ft: {
          currentSerial: data.stages.ft?.currentSerial || '',
          targetSerial: data.stages.ft?.targetSerial || '',
        },
        dlc: {
          currentSerial: data.stages.dlc?.currentSerial || '',
          targetSerial: data.stages.dlc?.targetSerial || '',
        },
      });
    }
  }, [data.stages]);

  const [toastMessage, setToastMessage] = useState(null);
  const [confirmResetModal, setConfirmResetModal] = useState(false);
  const [batchTargetSerial, setBatchTargetSerial] = useState('PST20500');

  // Always auto-detect shift — not editable
  const currentShift = useMemo(() => getAutoShift(), []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSerialChange = (stageKey, field, value) => {
    setSerialInputs(prev => ({
      ...prev,
      [stageKey]: {
        ...prev[stageKey],
        [field]: value.toUpperCase()
      }
    }));
  };

  const handleSaveStage = (stageKey) => {
    const { currentSerial, targetSerial } = serialInputs[stageKey];
    setStageSerial({
      stage: stageKey,
      currentSerial,
      targetSerial,
      operator: adminUser?.username || 'Admin Serial Update'
    });
    showToast(`Saved ${stages[stageKey]?.name || stageKey} Proteus: ${currentSerial} (Target: ${targetSerial})`);
  };

  const handleQuickDelta = (stageKey, delta) => {
    incrementCount(stageKey, delta, `${adminUser?.username || 'Admin'} (${delta > 0 ? '+' : ''}${delta})`);
    showToast(`${delta > 0 ? '+' : ''}${delta} Proteus advanced on ${stages[stageKey]?.name}`);
  };

  const handleApplyBatchRange = () => {
    resetProduction({
      mode: 'next_batch',
      newTargetSerial: batchTargetSerial,
      newShift: currentShift,
      operator: adminUser?.username || 'Admin'
    });
    setConfirmResetModal(false);
    showToast(`Target Proteus Updated to: ${batchTargetSerial}`);
  };

  const renderStageCard = (stageKey, title, Icon, colorClass) => {
    const stageObj = stages[stageKey] || { currentSerial: 'PST20001', targetSerial: 'PST20200', currentCount: 0, targetCount: 200 };
    const localVals = serialInputs[stageKey] || { currentSerial: stageObj.currentSerial, targetSerial: stageObj.targetSerial };

    return (
      <div className={`admin-card ${colorClass}`}>
        <div className="admin-card-header">
          <div className="admin-stage-badge">
            <Icon size={20} color="#ea580c" />
            <span>{title}</span>
          </div>
          <span className="admin-tag-synced">Sync Active</span>
        </div>

        {/* Live Serial Number Display */}
        <div className="admin-current-display">
          <div>
            <div className="admin-label-muted">
              <span className="text-red-highlight">CURRENT</span> PROTEUS
            </div>
            <div className="admin-big-count">
              {stageObj.currentSerial}
            </div>
            <div className="admin-subtext-white">
              Completed: <strong>{stageObj.currentCount} units</strong>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="admin-label-muted">
              <span className="text-red-highlight">TARGET</span> PROTEUS
            </div>
            <div className="admin-target-display">
              {stageObj.targetSerial}
            </div>
            <div className="admin-subtext-muted">
              Target: {stageObj.targetCount} units
            </div>
          </div>
        </div>

        {/* Quick Tap Serial Advance Buttons */}
        <div className="admin-section-subtitle">
          QUICK PROTEUS ADVANCE
        </div>
        <div className="admin-quick-buttons">
          <button className="quick-btn quick-btn-dec" onClick={() => handleQuickDelta(stageKey, -1)} title="Previous Serial (-1)">
            -1
          </button>
          <button className="quick-btn" onClick={() => handleQuickDelta(stageKey, 1)} title="Next Serial (+1)">
            +1
          </button>
          <button className="quick-btn" onClick={() => handleQuickDelta(stageKey, 5)} title="+5 Serials">
            +5
          </button>
          <button className="quick-btn" onClick={() => handleQuickDelta(stageKey, 10)} title="+10 Serials">
            +10
          </button>
        </div>

        {/* Direct Serial Number Edits */}
        <div className="admin-form-divider">
          <div className="admin-form-group">
            <label className="admin-input-label">
              <ScanLine size={14} color="#ea580c" />
              <span>Current Proteus (Scan / Type)</span>
            </label>
            <input
              type="text"
              className="admin-input"
              value={localVals.currentSerial}
              onChange={(e) => handleSerialChange(stageKey, 'currentSerial', e.target.value)}
              placeholder="e.g. PST20145"
            />
          </div>

          <div className="admin-form-group">
            <label className="admin-input-label">Target Proteus</label>
            <input
              type="text"
              className="admin-input"
              value={localVals.targetSerial}
              onChange={(e) => handleSerialChange(stageKey, 'targetSerial', e.target.value)}
              placeholder="e.g. PST20500"
            />
          </div>

          <button 
            className="btn-orange-solid" 
            style={{ width: '100%', marginTop: '0.6rem' }}
            onClick={() => handleSaveStage(stageKey)}
          >
            <Save size={16} />
            <span>Set / Save {stageObj.name || title}</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="admin-layout">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="sync-toast">
          <CheckCircle size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Application Bar (matching screenshot style) */}
      <div className="admin-top-appbar">
        <div className="appbar-left">
          <div className="appbar-title">
            <span className="appbar-badge-icon"><ShieldCheck size={18} /></span>
            <span>Proteus Production Manager</span>
            <span className="appbar-version">v1.2.6</span>
            <span className="appbar-mode">Mode: Real-Time</span>
          </div>
        </div>

        <div className="appbar-right">
          <div className="admin-user-pill">
            <span className="admin-user-dot" />
            <span>Admin: <strong>{adminUser?.username || 'admin'}</strong></span>
          </div>

          <button className="btn-orange-pill" onClick={() => setConfirmResetModal(true)}>
            <QrCode size={15} />
            <span>Batch Range Config</span>
          </button>

          <button className="btn-dark-pill" onClick={onLogout} title="Lock Admin Session">
            <span>Lock / Logout</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Bar */}
      <div className="admin-nav-tabs-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>
          <span className="live-dot" />
          <span>Live Production Line Management</span>
        </div>

        <div className="admin-nav-controls">
          {/* Shift display — auto-detected, NOT editable */}
          <div className="admin-shift-pill-display" title="Shift automatically detected by system time (6am-2pm / 2pm-10pm / 10pm-6am)">
            <Clock size={14} color="#ea580c" />
            <span>{currentShift}</span>
            <span className="admin-shift-auto-tag">AUTO</span>
            <Lock size={12} color="#64748b" style={{ marginLeft: '0.15rem' }} />
          </div>

          <button className="btn-orange-solid" onClick={onBackToDashboard} id="btn-back-dashboard">
            <ArrowLeft size={16} />
            <span>Open TV Display</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="admin-main-container">
        <div className="admin-section-header">
          <h2>Production Services & Line Controls</h2>
          <span className="admin-section-desc">Adjust live station serial counters, set stage targets, and audit updates in real time</span>
        </div>

        {/* 3 Stage Admin Control Cards */}
        <div className="admin-grid">
          {renderStageCard('assembly', 'Assembly Line', Layers, 'assembly')}
          {renderStageCard('ft', 'FT (Functional Test)', Activity, 'ft')}
          {renderStageCard('dlc', 'DLC (Burn-in & Life Cycle)', ShieldCheck, 'dlc')}
        </div>

        {/* Recent Activity Log */}
        <div className="admin-log-panel">
          <div className="admin-log-panel-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Clock size={18} color="#ea580c" />
              <h3>Logs & Station Activity</h3>
            </div>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Real-Time Synchronization Active</span>
          </div>

          <div className="admin-log-list">
            {data.logs && data.logs.length > 0 ? (
              data.logs.map((log) => (
                <div key={log.id} className={`admin-log-item ${log.stage || ''}`}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span className="admin-log-badge">{log.operator || 'ADMIN'}</span>
                    <span>{log.message || `${log.stageName || log.stage} ➔ Serial ${log.currentSerial || ''} (Target: ${log.targetSerial || ''})`}</span>
                  </div>
                  <div className="admin-log-timestamp">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ color: '#64748b', fontSize: '0.9rem', padding: '1rem' }}>No activity logged yet today.</div>
            )}
          </div>
        </div>
      </div>

      {/* Batch / Reset Modal */}
      {confirmResetModal && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-card">
            <div className="admin-modal-header">
              <div className="admin-modal-icon">
                <QrCode size={24} color="#ea580c" />
              </div>
              <div>
                <h3>Configure Target Proteus</h3>
                <p>Synchronize global target serial number across all 3 production stages</p>
              </div>
            </div>

            <div className="admin-modal-body">
              <div className="admin-form-group">
                <label className="admin-input-label">Global Target Proteus</label>
                <input
                  type="text"
                  className="admin-input"
                  value={batchTargetSerial}
                  onChange={(e) => setBatchTargetSerial(e.target.value.toUpperCase())}
                  placeholder="e.g. PST20500"
                />
              </div>
            </div>

            <div className="admin-modal-footer">
              <button className="btn-dark-pill" onClick={() => setConfirmResetModal(false)}>
                Cancel
              </button>
              <button 
                className="btn-orange-solid" 
                onClick={handleApplyBatchRange}
              >
                Apply Target to All Stages
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
