import React, { useEffect, useState } from 'react';
import { Header } from './Header';
import { StageCard } from './StageCard';
import { useProduction } from '../context/ProductionContext';
import { Zap, Minimize, Truck, CheckCircle2, TrendingUp, PackageCheck } from 'lucide-react';

export const Dashboard = ({ onOpenAdmin }) => {
  const { data } = useProduction();
  const stages = data.stages || {};
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement || document.webkitFullscreenElement));
  const [viewMode, setViewMode] = useState('auto');

  // Sync fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement || document.webkitFullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(err => console.error(err));
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  };

  const handleExitFullscreen = () => {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(err => console.error(err));
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  };

  // Keyboard: M to open admin
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.key === 'm' || e.key === 'M') {
        onOpenAdmin();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenAdmin]);

  // Sync viewMode to body class
  useEffect(() => {
    if (viewMode === 'inverse') {
      document.body.classList.add('view-inverse-active');
    } else {
      document.body.classList.remove('view-inverse-active');
    }
    return () => document.body.classList.remove('view-inverse-active');
  }, [viewMode]);

  const assembly = stages.assembly || {};
  const ft = stages.ft || {};
  const dlc = stages.dlc || {};
  const oqc = stages.oqc || {};
  const shipment = stages.shipment || {};

  const totalDone = (assembly.doneCount || 0) + (ft.doneCount || 0) + (dlc.doneCount || 0) + (oqc.doneCount || 0) + (shipment.doneCount || 0);
  const totalTarget = (assembly.totalCount || 0) + (ft.totalCount || 0) + (dlc.totalCount || 0) + (oqc.totalCount || 0) + (shipment.totalCount || 0);
  const overallPct = totalTarget > 0 ? Math.round((totalDone / totalTarget) * 100) : 0;

  // Shipment summary details
  const shipDone = shipment.doneCount || 0;
  const shipTotal = shipment.totalCount || 50;
  const shipPct = shipTotal > 0 ? Math.min(100, Math.round((shipDone / shipTotal) * 100)) : 0;
  const shipRemaining = Math.max(0, shipTotal - shipDone);
  const shipStart = shipment.startSerial || '---';
  const shipEnd = shipment.endSerial || '---';
  const shipCompleted = shipDone >= shipTotal && shipTotal > 0;

  return (
    <div className={`tv-container${viewMode === 'inverse' ? ' view-inverse' : ''}${isFullscreen ? ' is-fullscreen' : ''}`}>
      <div className="tv-background" />

      {/* Floating Exit Button in Fullscreen */}
      {isFullscreen && (
        <button
          className="tv-btn-fullscreen-exit"
          onClick={handleExitFullscreen}
          title="Exit Fullscreen Mode (Esc)"
          id="btn-exit-fullscreen"
        >
          <Minimize size={18} />
          <span>Exit Fullscreen</span>
        </button>
      )}

      {/* Header - Only visible when not in Fullscreen */}
      {!isFullscreen && (
        <Header 
          onOpenAdmin={onOpenAdmin} 
          viewMode={viewMode} 
          onToggleViewMode={() => setViewMode(v => v === 'auto' ? 'inverse' : 'auto')}
          isFullscreen={isFullscreen}
          onToggleFullscreen={handleToggleFullscreen}
        />
      )}

      {/* Shipment Details Bar — Just below navbar */}
      <section className="tv-shipment-banner" aria-label="Shipment Details">
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

      {/* 4 Stage Cards: Assembly, FT, DLC, OQC */}
      <main className="tv-stages-grid">
        <StageCard stageKey="assembly" stageData={assembly} stepIndex={1} />
        <StageCard stageKey="ft" stageData={ft} stepIndex={2} />
        <StageCard stageKey="dlc" stageData={dlc} stepIndex={3} />
        <StageCard stageKey="oqc" stageData={oqc} stepIndex={4} />
      </main>

      {/* Footer */}
      {!isFullscreen && (
        <footer className="tv-footer">
          <div className="tv-footer-stats">
            <div className="tv-total-badge">
              <Zap size={18} color="#fb923c" />
              <span>Overall Target Yield: <strong>{overallPct}%</strong></span>
            </div>
          </div>

          <div className="tv-actions">
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Proteus Plant TV Display (43" 16:9 Zero-Scroll Mode)
            </span>
          </div>
        </footer>
      )}
    </div>
  );
};
