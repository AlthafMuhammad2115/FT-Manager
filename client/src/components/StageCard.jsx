import React, { useMemo } from 'react';
import { Layers, Activity, ShieldCheck, ClipboardCheck, Truck, CheckCircle2, TrendingUp, AlertCircle, Target, ChevronsUp, Sparkles } from 'lucide-react';

export const StageCard = ({ stageKey, stageData, stepIndex }) => {
  const doneCount = stageData?.doneCount ?? 0;
  const totalCount = stageData?.totalCount ?? 50;
  const startSerial = stageData?.startSerial || '---';
  const endSerial = stageData?.endSerial || '---';

  const percentage = totalCount > 0 ? Math.min(100, Math.round((doneCount / totalCount) * 100)) : 0;
  const remaining = Math.max(0, totalCount - doneCount);
  const isCompleted = doneCount >= totalCount && totalCount > 0;

  // Dynamic gap between Target (top) and Current (bottom)
  const gapHeight = useMemo(() => {
    return Math.round(38 - (percentage / 100) * 26);
  }, [percentage]);

  // Icon selector
  const getIcon = () => {
    switch (stageKey) {
      case 'assembly':
        return <Layers size={28} />;
      case 'ft':
        return <Activity size={28} />;
      case 'dlc':
        return <ShieldCheck size={28} />;
      case 'oqc':
        return <ClipboardCheck size={28} />;
      case 'shipment':
        return <Truck size={28} />;
      default:
        return <Layers size={28} />;
    }
  };

  return (
    <div className={`tv-card ${stageKey} ${isCompleted ? 'pulse-completed' : ''}`}>
      {/* Card Top Header */}
      <div className="tv-card-header">
        <div className="tv-card-badge-wrap">
          <div className="tv-stage-icon-wrap">
            {getIcon()}
          </div>
          <div className="tv-stage-title-wrap">
            <h2>{stageData?.name || stageKey.toUpperCase()}</h2>
            <span>{stageData?.subtext || 'Production Line'}</span>
          </div>
        </div>
        <div className="tv-stage-step-num">STAGE 0{stepIndex}</div>
      </div>

      {/* Main Metric Body */}
      <div className="tv-card-body">

        {/* 1. TARGET / RANGE BOX */}
        <div className="tv-count-box tv-target-count-box">
          <div className="tv-metric-header">
            <Target size={16} color="#ef4444" />
            <div className="tv-metric-label">
              <span className="text-red-highlight">DAILY</span> BATCH RANGE
            </div>
          </div>
          
          {/* Serial Range Display — wraps to two lines only if content overflows */}
          <div className="tv-serial-range">
            <span className="tv-serial-start">{startSerial}</span>
            <span className="tv-serial-arrow">→</span>
            <span className="tv-serial-end">{endSerial}</span>
          </div>

          <div className="tv-metric-subpill">
            <span>Target: <strong>{totalCount} Units</strong></span>
            <span className="tv-subpill-divider">•</span>
            <span>Remaining: <strong className={remaining > 0 ? 'text-remaining-warn' : 'text-remaining-good'}>{remaining}</strong></span>
          </div>
        </div>

        {/* 2. DYNAMIC ARROW GAP CONNECTOR */}
        <div 
          className={`tv-stage-gap-connector ${isCompleted ? 'completed' : ''}`}
          style={{ height: `${gapHeight}px` }}
        >
          <div className="tv-connector-line left" />
          <div className="tv-animated-arrow-wrap">
            {isCompleted ? (
              <span className="tv-arrow-synced-badge">
                <Sparkles size={13} color="#34d399" />
                <span>TARGET REACHED</span>
              </span>
            ) : (
              <div className="tv-arrow-indicator">
                <ChevronsUp size={20} className="tv-arrow-float-icon" />
              </div>
            )}
          </div>
          <div className="tv-connector-line right" />
        </div>

        {/* 3. COMPLETED COUNT BOX */}
        <div className={`tv-count-box tv-current-count-box ${isCompleted ? 'target-reached' : ''}`}>
          <div className="tv-metric-header">
            <CheckCircle2 size={16} color="#10b981" />
            <div className="tv-metric-label">
              <span className="text-red-highlight">COMPLETED</span> COUNT
            </div>
          </div>
          
          {/* Big Count Display */}
          <div className="tv-huge-number tv-done-count">
            {doneCount} <span className="tv-done-count-total">/ {totalCount}</span>
          </div>

          <div className="tv-metric-subpill">
            <span>Done: <strong>{doneCount} Units</strong></span>
          </div>
        </div>

        {/* Completion Progress Bar */}
        <div className="tv-progress-section">
          <div className="tv-progress-info">
            <span>STAGE COMPLETION PROGRESS</span>
            <span className="tv-progress-pct">{percentage}%</span>
          </div>
          <div className="tv-progress-track">
            <div
              className="tv-progress-fill"
              style={{ width: `${Math.min(100, percentage)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Card Bottom Status */}
      <div className="tv-card-footer">
        <div className={`tv-status-pill ${isCompleted ? 'status-completed' : (percentage >= 50 ? 'status-on-track' : 'status-in-progress')}`}>
          {isCompleted ? (
            <>
              <CheckCircle2 size={15} />
              <span>TARGET REACHED</span>
            </>
          ) : percentage >= 50 ? (
            <>
              <TrendingUp size={15} />
              <span>ON TRACK</span>
            </>
          ) : (
            <>
              <AlertCircle size={15} />
              <span>IN PRODUCTION</span>
            </>
          )}
        </div>

        {/* <div className="tv-remaining-text">
          Batch: <strong>{startSerial} → {endSerial}</strong>
        </div> */}
      </div>
    </div>
  );
};
