import React, { useState, useMemo } from 'react';
import { useProduction } from '../context/ProductionContext';
import { 
  ArrowLeft, 
  Save, 
  Layers, 
  Activity, 
  ShieldCheck, 
  ClipboardCheck,
  Truck,
  Target,
  Clock, 
  CheckCircle, 
  QrCode,
  Lock,
  Settings
} from 'lucide-react';

export const AdminPanel = ({ adminUser, onBackToDashboard, onLogout }) => {
  const { data, updateUnitStatus, configureBatch } = useProduction();
  const units = data.units || [];
  const stages = data.stages || {};

  const [toastMessage, setToastMessage] = useState(null);
  const [configModal, setConfigModal] = useState(false);
  const [configStartNum, setConfigStartNum] = useState(data.startNum || 20001);
  const [configDailyTarget, setConfigDailyTarget] = useState(data.dailyTarget || 50);
  const [configPrefix, setConfigPrefix] = useState(data.prefix || 'PST');

  // Allowed stages for this admin
  const allowedStages = useMemo(() => {
    if (adminUser?.allowedStages && Array.isArray(adminUser.allowedStages)) {
      return adminUser.allowedStages;
    }
    const uname = (adminUser?.username || '').toLowerCase();
    if (uname === 'admin_anora' || uname === 'admin_user') return ['assembly', 'ft', 'dlc', 'oqc', 'shipment'];
    if (uname === 'admin_assembly') return ['assembly'];
    if (uname === 'admin_ft') return ['ft'];
    if (uname === 'admin_dlc') return ['dlc'];
    if (uname === 'admin_oqc') return ['oqc'];
    if (uname === 'admin_shipment') return ['shipment'];
    return ['assembly', 'ft', 'dlc', 'oqc', 'shipment'];
  }, [adminUser]);

  const canBatchConfig = useMemo(() => {
    if (typeof adminUser?.canBatchConfig === 'boolean') return adminUser.canBatchConfig;
    const uname = (adminUser?.username || '').toLowerCase();
    return uname === 'admin_anora' || uname === 'admin_user';
  }, [adminUser]);


  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Handle clicking a unit box
  const handleUnitClick = (serial, stage, currentStatus) => {
    if (!allowedStages.includes(stage)) {
      showToast(`Unauthorized: You cannot edit ${stage.toUpperCase()}`);
      return;
    }

    const newStatus = currentStatus === 'done' ? 'pending' : 'done';
    updateUnitStatus(serial, stage, newStatus)
      .then(res => {
        if (res && res.success) {
          showToast(`${serial} → ${stage.toUpperCase()}: ${newStatus.toUpperCase()}`);
        } else if (res && res.message) {
          showToast(res.message);
        }
      })
      .catch(() => {
        showToast(`Failed to update ${serial}`);
      });
  };

  // Determine unit box state for a given stage
  const getUnitBoxState = (unit, stage) => {
    const status = unit[stage];
    if (status === 'done') return 'done';
    
    // Check cascading: is the previous stage done?
    if (stage === 'assembly') return 'ready'; // Assembly is always editable
    if (stage === 'ft') return unit.assembly === 'done' ? 'ready' : 'locked';
    if (stage === 'dlc') return unit.ft === 'done' ? 'ready' : 'locked';
    if (stage === 'oqc') return unit.dlc === 'done' ? 'ready' : 'locked';
    if (stage === 'shipment') return unit.oqc === 'done' ? 'ready' : 'locked';
    return 'locked';
  };

  const handleApplyConfig = () => {
    if (!canBatchConfig) {
      showToast('Unauthorized: Super Admin credentials required');
      return;
    }
    configureBatch(configStartNum, configDailyTarget, configPrefix)
      .then(res => {
        if (res && res.success) {
          showToast(res.message || 'Batch configured successfully');
          setConfigModal(false);
        } else {
          showToast(res?.message || 'Configuration failed');
        }
      });
  };

  const renderStageSection = (stageKey, title, Icon, colorClass) => {
    const stageInfo = stages[stageKey] || { doneCount: 0, totalCount: 50 };
    const canEdit = allowedStages.includes(stageKey);
    const doneCount = stageInfo.doneCount || 0;
    const totalCount = stageInfo.totalCount || 50;
    const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

    return (
      <div className={`admin-stage-section ${colorClass} ${!canEdit ? 'is-locked' : ''}`}>
        {/* Stage Header */}
        <div className="admin-stage-header">
          <div className="admin-stage-badge">
            <Icon size={20} color={canEdit ? '#ea580c' : '#64748b'} />
            <span>{title}</span>
          </div>
          <div className="admin-stage-stats">
            <span className="admin-stage-count">{doneCount} / {totalCount}</span>
            <span className={`admin-stage-pct ${pct >= 100 ? 'complete' : pct >= 50 ? 'on-track' : ''}`}>{pct}%</span>
            {canEdit ? (
              <span className="admin-tag-synced">Edit Access</span>
            ) : (
              <span className="admin-tag-locked">
                <Lock size={12} />
                <span>Read-Only</span>
              </span>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="admin-stage-progress">
          <div className="admin-stage-progress-fill" style={{ width: `${Math.min(100, pct)}%` }} />
        </div>

        {/* Unit Grid */}
        <div className="unit-grid">
          {units.map((unit) => {
            const boxState = getUnitBoxState(unit, stageKey);
            const isClickable = canEdit && (boxState === 'ready' || boxState === 'done');

            return (
              <button
                key={`${unit.serial}-${stageKey}`}
                className={`unit-box unit-box-${boxState}${unit.isOverdue && boxState !== 'done' ? ' unit-box-overdue' : ''}`}
                onClick={() => isClickable && handleUnitClick(unit.serial, stageKey, unit[stageKey])}
                disabled={!isClickable}
                title={
                  unit.isOverdue && boxState !== 'done'
                    ? `${unit.serial} — OVERDUE (pending from previous batch)`
                    : boxState === 'done' 
                      ? `${unit.serial} ✓ Done — Click to undo` 
                      : boxState === 'ready' 
                        ? `${unit.serial} — Click to mark done` 
                        : `${unit.serial} — Locked (previous stage not done)`
                }
              >
                <span className="unit-box-serial">{unit.serial.replace(data.prefix || 'PST', '')}</span>
                {boxState === 'done' && <CheckCircle size={14} className="unit-box-check" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="admin-layout">
      {/* Toast */}
      {toastMessage && (
        <div className="sync-toast">
          <CheckCircle size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top App Bar */}
      <div className="admin-top-appbar">
        <div className="appbar-left">
          <div className="appbar-title">
            <span className="appbar-badge-icon"><ShieldCheck size={18} /></span>
            <span>Proteus Production Manager</span>
            <span className="appbar-version">v2.0</span>
            <span className="appbar-mode">Mode: Per-Unit Tracking</span>
          </div>
        </div>

        <div className="appbar-right">
          <div className="admin-user-pill">
            <span className="admin-user-dot" />
            <span>Admin: <strong>{adminUser?.username || 'admin'}</strong></span>
            <span className="admin-role-badge">
              {canBatchConfig ? 'Super Admin' : (adminUser?.role || 'Station Supervisor')}
            </span>
          </div>

          {canBatchConfig ? (
            <button className="btn-orange-pill" onClick={() => {
              setConfigStartNum(data.startNum || 20001);
              setConfigDailyTarget(data.dailyTarget || 50);
              setConfigPrefix(data.prefix || 'PST');
              setConfigModal(true);
            }}>
              <Settings size={15} />
              <span>Batch Config</span>
            </button>
          ) : (
            <button className="btn-orange-pill" disabled title="Requires Super Admin (admin_anora)">
              <Lock size={13} />
              <span>Batch Config (Locked)</span>
            </button>
          )}

          <button className="btn-dark-pill" onClick={onLogout} title="Lock Admin Session">
            <span>Lock / Logout</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Bar */}
      <div className="admin-nav-tabs-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>
          <span className="live-dot" />
          <span>Live Per-Unit Status Tracking</span>
          <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '0.5rem' }}>
            Batch: {data.stages?.assembly?.startSerial || '---'} → {data.stages?.assembly?.endSerial || '---'} ({data.dailyTarget || 50} units)
          </span>
        </div>

        <div className="admin-nav-controls">
          <div className="admin-shift-pill-display" title="Configured Daily Target">
            <Target size={14} color="#ea580c" />
            <span>Target: <strong>{data.dailyTarget || 50} Units</strong></span>
          </div>

          <button className="btn-orange-solid" onClick={onBackToDashboard} id="btn-back-dashboard">
            <ArrowLeft size={16} />
            <span>Open TV Display</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="admin-main-container">
        <div className="admin-section-header">
          <h2>Per-Unit Production Tracking</h2>
          <span className="admin-section-desc">
            Click a unit box to mark it as done at a stage. Green = done, Orange = ready, Grey = locked (previous stage pending).
          </span>
        </div>

        {/* 5 Stage Sections with Unit Grids */}
        <div className="admin-stages-stack">
          {renderStageSection('assembly', 'Assembly Line', Layers, 'assembly')}
          {renderStageSection('ft', 'FT (Functional Test)', Activity, 'ft')}
          {renderStageSection('dlc', 'DLC (Burn-in & Life Cycle)', ShieldCheck, 'dlc')}
          {renderStageSection('oqc', 'OQC (Outgoing Quality Control)', ClipboardCheck, 'oqc')}
          {renderStageSection('shipment', 'Shipment & Dispatch', Truck, 'shipment')}
        </div>
      </div>

      {/* Batch Config Modal */}
      {configModal && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-card">
            <div className="admin-modal-header">
              <div className="admin-modal-icon">
                <QrCode size={24} color="#ea580c" />
              </div>
              <div>
                <h3>Configure Daily Batch</h3>
                <p>Set the starting serial number, prefix, and daily target count</p>
              </div>
            </div>

            <div className="admin-modal-body">
              <div className="admin-form-group">
                <label className="admin-input-label">Serial Prefix</label>
                <input
                  type="text"
                  className="admin-input"
                  value={configPrefix}
                  onChange={(e) => setConfigPrefix(e.target.value.toUpperCase())}
                  placeholder="e.g. PST"
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-input-label">Starting Serial Number</label>
                <input
                  type="number"
                  className="admin-input"
                  value={configStartNum}
                  onChange={(e) => setConfigStartNum(parseInt(e.target.value, 10) || 0)}
                  placeholder="e.g. 21001"
                />
                <span className="admin-input-hint">
                  First unit: {configPrefix}{String(configStartNum).padStart(5, '0')}
                </span>
              </div>

              <div className="admin-form-group">
                <label className="admin-input-label">Daily Target (number of units)</label>
                <input
                  type="number"
                  className="admin-input"
                  value={configDailyTarget}
                  onChange={(e) => setConfigDailyTarget(parseInt(e.target.value, 10) || 50)}
                  placeholder="e.g. 50"
                  min="1"
                  max="500"
                />
                <span className="admin-input-hint">
                  Range: {configPrefix}{String(configStartNum).padStart(5, '0')} → {configPrefix}{String(configStartNum + (configDailyTarget || 50) - 1).padStart(5, '0')}
                </span>
              </div>
            </div>

            <div className="admin-modal-footer">
              <button className="btn-dark-pill" onClick={() => setConfigModal(false)}>
                Cancel
              </button>
              <button className="btn-orange-solid" onClick={handleApplyConfig}>
                <Save size={16} />
                <span>Apply Batch Configuration</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
