import React from 'react';
import { useProduction } from '../context/ProductionContext';
import {
  Layers,
  Activity,
  ShieldCheck,
  ClipboardCheck,
  CheckCircle,
  Lock,
  ArrowLeft,
  Cpu,
  Target,
  Truck,
  CheckCircle2,
  TrendingUp,
  PackageCheck
} from 'lucide-react';

export const LiveStatus = ({ onBackToDashboard }) => {
  const { data, connected } = useProduction();
  const units = data.units || [];
  const stages = data.stages || {};

  // Determine unit box state for a given stage (read-only — no editing)
  const getUnitBoxState = (unit, stage) => {
    const status = unit[stage];
    if (status === 'done') return 'done';
    if (stage === 'assembly') return 'ready';
    if (stage === 'ft') return unit.assembly === 'done' ? 'ready' : 'locked';
    if (stage === 'dlc') return unit.ft === 'done' ? 'ready' : 'locked';
    if (stage === 'oqc') return unit.dlc === 'done' ? 'ready' : 'locked';
    if (stage === 'shipment') return unit.oqc === 'done' ? 'ready' : 'locked';
    return 'locked';
  };

  const renderStageSection = (stageKey, title, Icon) => {
    const stageInfo = stages[stageKey] || { doneCount: 0, totalCount: 50 };
    const doneCount = stageInfo.doneCount || 0;
    const totalCount = stageInfo.totalCount || 50;
    const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

    return (
      <div className={`admin-stage-section ${stageKey} is-locked`}>
        {/* Stage Header */}
        <div className="admin-stage-header">
          <div className="admin-stage-badge">
            <Icon size={20} color="#ea580c" />
            <span>{title}</span>
          </div>
          <div className="admin-stage-stats">
            <span className="admin-stage-count">{doneCount} / {totalCount}</span>
            <span className={`admin-stage-pct ${pct >= 100 ? 'complete' : pct >= 50 ? 'on-track' : ''}`}>{pct}%</span>
            <span className="admin-tag-locked">
              <Lock size={12} />
              <span>Read-Only</span>
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="admin-stage-progress">
          <div className="admin-stage-progress-fill" style={{ width: `${Math.min(100, pct)}%` }} />
        </div>

        {/* Unit Grid — Read Only */}
        <div className="unit-grid">
          {units.map((unit) => {
            const boxState = getUnitBoxState(unit, stageKey);
            return (
              <div
                key={`${unit.serial}-${stageKey}`}
                className={`unit-box unit-box-${boxState}`}
                title={
                  boxState === 'done'
                    ? `${unit.serial} ✓ Done`
                    : boxState === 'ready'
                      ? `${unit.serial} — Pending`
                      : `${unit.serial} — Locked (previous stage not done)`
                }
                style={{ cursor: 'default' }}
              >
                <span className="unit-box-serial">{unit.serial.replace(data.prefix || 'PST', '')}</span>
                {boxState === 'done' && <CheckCircle size={14} className="unit-box-check" />}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Shipment data
  const shipment = stages.shipment || {};
  const shipDone = shipment.doneCount || 0;
  const shipTotal = shipment.totalCount || 50;
  const shipPct = shipTotal > 0 ? Math.min(100, Math.round((shipDone / shipTotal) * 100)) : 0;
  const shipRemaining = Math.max(0, shipTotal - shipDone);
  const shipStart = shipment.startSerial || '---';
  const shipEnd = shipment.endSerial || '---';
  const shipCompleted = shipDone >= shipTotal && shipTotal > 0;

  return (
    <div className="admin-layout live-status-layout">
      {/* Top App Bar */}
      <div className="admin-top-appbar">
        <div className="appbar-left">
          <div className="appbar-title">
            <span className="appbar-badge-icon"><Cpu size={18} /></span>
            <span>{data.productName || 'PROTEUS'} — Live Production Status</span>
            <span className="appbar-version">v2.0</span>
          </div>
        </div>

        <div className="appbar-right">
          <div className="admin-user-pill">
            <span className={`live-dot ${connected ? '' : 'disconnected'}`} style={{ backgroundColor: connected ? '#10b981' : '#ef4444' }} />
            <span>{connected ? 'LIVE SYNC' : 'OFFLINE'}</span>
          </div>

          <button className="btn-orange-solid" onClick={onBackToDashboard} id="btn-live-back-dashboard">
            <ArrowLeft size={16} />
            <span>Back to Dashboard</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Bar */}
      <div className="admin-nav-tabs-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>
          <span className="live-dot" />
          <span>Read-Only Per-Unit Status View</span>
          <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '0.5rem' }}>
            Batch: {stages.assembly?.startSerial || '---'} → {stages.assembly?.endSerial || '---'} ({data.dailyTarget || 50} units)
          </span>
        </div>

        <div className="admin-nav-controls">
          <div className="admin-shift-pill-display" title="Configured Daily Target">
            <Target size={14} color="#ea580c" />
            <span>Target: <strong>{data.dailyTarget || 50} Units</strong></span>
          </div>
        </div>
      </div>

      {/* Shipment Banner */}
      <section className="tv-shipment-banner live-status-shipment-banner" aria-label="Shipment Details">
        <div className="tv-shipment-left">
          <div className="tv-shipment-icon-wrap">
            <Truck size={20} />
          </div>
          <div className="tv-shipment-title-wrap">
            <h3>Shipment & Dispatch</h3>
            <span>Final Logistics & Packaging Fulfillment</span>
          </div>
        </div>

        <div className="tv-shipment-center">
          <div className="tv-shipment-range-box" title="Batch Serial Range">
            <span>{shipStart}</span>
            <span className="arrow">→</span>
            <span>{shipEnd}</span>
          </div>

          <div className="tv-shipment-progress-wrap">
            <div className="tv-shipment-progress-info">
              <span>DISPATCH PROGRESS</span>
              <strong>{shipPct}%</strong>
            </div>
            <div className="tv-shipment-progress-track">
              <div className="tv-shipment-progress-fill" style={{ width: `${Math.min(100, shipPct)}%` }} />
            </div>
          </div>
        </div>

        <div className="tv-shipment-right">
          <div className="tv-shipment-count-badge" title="Shipped / Total Units">
            <span className="tv-shipment-count-huge">{shipDone}</span>
            <span className="tv-shipment-count-total">/ {shipTotal} Units Shipped</span>
          </div>

          <div className={`tv-shipment-status-pill ${shipCompleted ? 'completed' : shipDone > 0 ? 'in-progress' : 'pending'}`}>
            {shipCompleted ? (
              <>
                <CheckCircle2 size={13} />
                <span>ALL DISPATCHED</span>
              </>
            ) : shipDone > 0 ? (
              <>
                <TrendingUp size={13} />
                <span>{shipRemaining} REMAINING</span>
              </>
            ) : (
              <>
                <PackageCheck size={13} />
                <span>AWAITING DISPATCH</span>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="admin-main-container">
        <div className="admin-section-header">
          <h2>Per-Unit Production Status (Read-Only)</h2>
          <span className="admin-section-desc">
            Green = done, Orange = ready/pending, Grey = locked (previous stage pending). This is a live, auto-updating view.
          </span>
        </div>

        {/* 4 Stage Sections with Unit Grids */}
        <div className="admin-stages-stack">
          {renderStageSection('assembly', 'Assembly Line', Layers)}
          {renderStageSection('ft', 'FT (Functional Test)', Activity)}
          {renderStageSection('dlc', 'DLC (Burn-in & Life Cycle)', ShieldCheck)}
          {renderStageSection('oqc', 'OQC (Outgoing Quality Control)', ClipboardCheck)}
        </div>
      </div>
    </div>
  );
};
