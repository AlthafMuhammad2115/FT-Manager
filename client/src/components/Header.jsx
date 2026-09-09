import React, { useState, useEffect } from 'react';
import { Cpu, Maximize, Minimize, Settings, Monitor, Smartphone, Target, Eye } from 'lucide-react';
import { useProduction } from '../context/ProductionContext';

export const Header = ({ onOpenAdmin, onOpenLive, viewMode = 'auto', onToggleViewMode, isFullscreen = false, onToggleFullscreen }) => {
  const { data, connected } = useProduction();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleFullscreenClick = () => {
    if (onToggleFullscreen) {
      onToggleFullscreen();
    } else {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
          console.error(`Error attempting to enable fullscreen: ${err.message}`);
        });
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        }
      }
    }
  };

  const formattedTime = time.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  const formattedDate = time.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <header className="tv-header">
      <div className="tv-brand">
        <div className="tv-brand-logo">
          <Cpu size={30} />
        </div>
        <div className="tv-title-group">
          <h1>{data.productName || 'PROTEUS'} MASS PRODUCTION</h1>
          <div className="tv-subtitle">Multi-Stage Real-Time Assembly & Testing Tracker</div>
        </div>
      </div>

      <div className="tv-header-center">
        <div className="tv-badge">
          <span className={`live-dot ${connected ? '' : 'disconnected'}`} style={{ backgroundColor: connected ? '#10b981' : '#ef4444' }} />
          <span>{connected ? 'LIVE SYNC' : 'OFFLINE'}</span>
        </div>

        {/* <div className="tv-badge tv-target-badge" title="Daily Batch Target">
          <Target size={15} color="#ea580c" />
          <span>Daily Target: <strong>{data.dailyTarget || 50} Units</strong></span>
        </div> */}

        <button 
          className="tv-btn tv-btn-live" 
          onClick={onOpenLive}
          title="Open Read-Only Live Status View"
          id="btn-live-status"
        >
          <Eye size={16} />
          <span>Live Status</span>
        </button>

        <button 
          className="tv-btn tv-btn-primary" 
          onClick={onOpenAdmin}
          title="Open Admin Edit Controls"
          id="btn-admin-panel"
        >
          <Settings size={16} />
          <span>Admin Panel</span>
        </button>

        <button 
          className={`tv-btn tv-view-toggle${viewMode === 'inverse' ? ' active' : ''}`}
          onClick={onToggleViewMode}
          title={viewMode === 'auto' ? 'Switch to Inverse View (Mobile on Desktop / Desktop on Mobile)' : 'Switch back to Auto Responsive View'}
          id="btn-view-mode-toggle"
        >
          {viewMode === 'inverse' ? <Smartphone size={15} /> : <Monitor size={15} />}
          <span className="tv-view-toggle-label">
            {viewMode === 'inverse' ? 'Inverse' : 'Auto'}
          </span>
          <span className="tv-view-toggle-track">
            <span className="tv-view-toggle-thumb" />
          </span>
        </button>

        <button 
          className="tv-btn" 
          onClick={handleFullscreenClick}
          title="Toggle Fullscreen (F11)"
          id="btn-fullscreen"
        >
          {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          <span>{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
        </button>
      </div>

      <div className="tv-clock-box">
        <div className="tv-clock-time">{formattedTime}</div>
        <div className="tv-clock-date">{formattedDate}</div>
      </div>
    </header>
  );
};

