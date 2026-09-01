import React, { useState, useEffect, useMemo } from 'react';
import { Activity, Clock, Cpu, Maximize, Minimize, Settings, Radio, Monitor, Smartphone } from 'lucide-react';
import { useProduction } from '../context/ProductionContext';

// Auto shift detection based on current time (matches server logic)
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

export const Header = ({ onOpenAdmin, viewMode = 'auto', onToggleViewMode }) => {
  const { data, connected } = useProduction();
  const [time, setTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
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

  // Always auto-detect shift from current time — not editable
  const currentShift = useMemo(() => getAutoShift(), [time]);

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

        <div className="tv-badge tv-shift-badge">
          <Radio size={15} color="#ea580c" />
          <span>{currentShift}</span>
          <span className="admin-shift-auto-tag" style={{ marginLeft: '0.25rem' }}>AUTO</span>
        </div>

        <button 
          className="tv-btn tv-btn-primary" 
          onClick={onOpenAdmin}
          title="Open Admin Control Panel"
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
          onClick={toggleFullscreen}
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
