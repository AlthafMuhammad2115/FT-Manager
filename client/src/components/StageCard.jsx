import React, { useMemo } from 'react';
import { Layers, Activity, ShieldCheck, CheckCircle2, TrendingUp, AlertCircle, QrCode, Target, ChevronUp, ChevronsUp, Sparkles } from 'lucide-react';

export const StageCard = ({ stageKey, stageData, isPulsing, stepIndex }) => {
  const currentSerial = stageData?.currentSerial || 'PST20001';
  const targetSerial = stageData?.targetSerial || 'PST20200';
  const startSerial = stageData?.startSerial || 'PST20001';
  const currentCount = stageData?.currentCount ?? stageData?.current ?? 0;
  const targetCount = stageData?.targetCount ?? stageData?.target ?? 200;

  const percentage = Math.min(100, Math.round((currentCount / (targetCount > 0 ? targetCount : 1)) * 100));
  const remaining = Math.max(0, targetCount - currentCount);
  const isCompleted = currentCount >= targetCount && targetCount > 0;

  // Dynamic gap between Target (top) and Current (bottom):
  // At 0% completed -> 38px gap with animated upward arrows
  // At 100% completed -> smoothly reduces to 10px (NO overlapping)
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
      default:
        return <Layers size={28} />;
    }
  };

  return (
    <div className={`tv-card ${stageKey} ${isPulsing ? 'pulse-updated' : ''}`}>
      {/* Card Top Header */}
      <div className="tv-card-header">
        <div className="tv-card-badge-wrap">
          <div className="tv-stage-icon-wrap">
            {getIcon()}
          </div>
          <div className="tv-stage-title-wrap">
            <h2>{stageData?.name || stageKey.toUpperCase()}</h2>
            <span>{stageData?.subtext || (stageKey === 'ft' ? 'Functional Testing' : 'Production Line')}</span>
          </div>
        </div>
        <div className="tv-stage-step-num">STAGE 0{stepIndex}</div>
      </div>

      {/* Main Metric Body */}
      <div className="tv-card-body">

        {/* 1. TARGET PROTEUS BOX (AT TOP) */}
        <div className="tv-count-box tv-target-count-box">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
            <Target size={16} color="#ef4444" />
            <div className="tv-metric-label" style={{ marginBottom: 0 }}>
              <span className="text-red-highlight">TARGET</span> PROTEUS
            </div>
          </div>
          
          {/* Big Target Serial Number */}
          <div className="tv-huge-number tv-serial-text tv-target-serial">
            {targetSerial}
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(255,255,255,0.06)', padding: '0.2rem 0.8rem', borderRadius: '999px', fontSize: '0.85rem', color: '#cbd5e1', marginTop: '0.4rem' }}>
            <span>Shift Target:</span>
            <strong style={{ fontFamily: 'var(--font-mono)', color: '#ffffff' }}>{targetCount} Units</strong>
            <span>•</span>
            <span>Remaining: <strong style={{ fontFamily: 'var(--font-mono)', color: remaining > 0 ? '#fb923c' : '#34d399' }}>{remaining}</strong></span>
          </div>
        </div>

        {/* 2. DYNAMIC ARROW GAP CONNECTOR (SEPARATION DISTANCE THAT REDUCES TOWARDS TARGET) */}
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

        {/* 3. CURRENT PROTEUS BOX (BELOW TARGET) */}
        <div className={`tv-count-box tv-current-count-box ${isCompleted ? 'target-reached' : ''}`}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
            <QrCode size={16} color="#ef4444" />
            <div className="tv-metric-label" style={{ marginBottom: 0 }}>
              <span className="text-red-highlight">CURRENT</span> PROTEUS
            </div>
          </div>
          
          {/* Huge Glowing Serial Number */}
          <div className="tv-huge-number tv-serial-text">
            {currentSerial}
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(255,255,255,0.06)', padding: '0.2rem 0.8rem', borderRadius: '999px', fontSize: '0.85rem', color: '#cbd5e1', marginTop: '0.4rem' }}>
            <span>Completed Today:</span>
            <strong style={{ fontFamily: 'var(--font-mono)', color: '#ffffff' }}>{currentCount} Units</strong>
          </div>
        </div>

        {/* Completion Progress Bar */}
        <div className="tv-progress-section">
          <div className="tv-progress-info">
            <span>PROTEUS COMPLETION PROGRESS</span>
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

        <div className="tv-remaining-text">
          Target Proteus: <strong>{targetSerial}</strong>
        </div>
      </div>
    </div>
  );
};
