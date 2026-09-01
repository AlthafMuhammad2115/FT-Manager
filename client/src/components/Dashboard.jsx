import React, { useEffect, useState } from 'react';
import { Header } from './Header';
import { StageCard } from './StageCard';
import { useProduction } from '../context/ProductionContext';
import { BarChart3, CheckSquare, Zap, QrCode } from 'lucide-react';

export const Dashboard = ({ onOpenAdmin }) => {
  const { data, lastPulseStage, incrementCount } = useProduction();
  const stages = data.stages || {};
  const [viewMode, setViewMode] = useState('auto'); // 'auto' | 'inverse'

  const assembly = stages.assembly || { startSerial: 'PST20001', currentSerial: 'PST20001', targetSerial: 'PST20200', targetCount: 200, currentCount: 0 };
  const ft = stages.ft || { startSerial: 'PST20001', currentSerial: 'PST20001', targetSerial: 'PST20200', targetCount: 200, currentCount: 0 };
  const dlc = stages.dlc || { startSerial: 'PST20001', currentSerial: 'PST20001', targetSerial: 'PST20200', targetCount: 200, currentCount: 0 };

  const totalCompleted = (assembly.currentCount || 0) + (ft.currentCount || 0) + (dlc.currentCount || 0);
  const totalTargetUnits = (assembly.targetCount || 0) + (ft.targetCount || 0) + (dlc.targetCount || 0);
  const overallPct = totalTargetUnits > 0 ? Math.round((totalCompleted / totalTargetUnits) * 100) : 0;

  // Keyboard shortcut listener for physical keypad / barcode scanners
  useEffect(() => {
    const handleKeyDown = (e) => {
      // If user is inside an input field, do nothing
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.key === '1' || e.key === 'a' || e.key === 'A') {
        incrementCount('assembly', 1, 'Station 1 Tap');
      } else if (e.key === '2' || e.key === 'f' || e.key === 'F') {
        incrementCount('ft', 1, 'Station 2 Tap');
      } else if (e.key === '3' || e.key === 'd' || e.key === 'D') {
        incrementCount('dlc', 1, 'Station 3 Tap');
      } else if (e.key === 'm' || e.key === 'M') {
        onOpenAdmin();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [incrementCount, onOpenAdmin]);

  // Sync viewMode to body class so CSS can override html/body overflow on large screens
  useEffect(() => {
    if (viewMode === 'inverse') {
      document.body.classList.add('view-inverse-active');
    } else {
      document.body.classList.remove('view-inverse-active');
    }
    return () => document.body.classList.remove('view-inverse-active');
  }, [viewMode]);

  return (
    <div className={`tv-container${viewMode === 'inverse' ? ' view-inverse' : ''}`}>
      <div className="tv-background" />

      {/* Top Header */}
      <Header onOpenAdmin={onOpenAdmin} viewMode={viewMode} onToggleViewMode={() => setViewMode(v => v === 'auto' ? 'inverse' : 'auto')} />

      {/* 3 Columns / Cards: Assembly, FT, DLC */}
      <main className="tv-stages-grid">
        <StageCard
          stageKey="assembly"
          stageData={assembly}
          isPulsing={lastPulseStage === 'assembly'}
          stepIndex={1}
        />
        <StageCard
          stageKey="ft"
          stageData={ft}
          isPulsing={lastPulseStage === 'ft'}
          stepIndex={2}
        />
        <StageCard
          stageKey="dlc"
          stageData={dlc}
          isPulsing={lastPulseStage === 'dlc'}
          stepIndex={3}
        />
      </main>

      {/* Bottom Summary Bar */}
      <footer className="tv-footer">
        <div className="tv-footer-stats">
          <div className="tv-total-badge">
            <QrCode size={18} color="#ea580c" />
            <span>Latest Packout Serial: <strong>{dlc.currentSerial || 'PST20000'}</strong></span>
          </div>

          <div className="tv-total-badge">
            <BarChart3 size={18} color="#f97316" />
            <span>Cumulative Units Processed: <strong>{totalCompleted}</strong> Units</span>
          </div>

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
    </div>
  );
};
