import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';

const ProductionContext = createContext(null);

export const ProductionProvider = ({ children }) => {
  const [data, setData] = useState({
    productName: 'PROTEUS',
    shift: 'Shift 1 (Day)',
    lastUpdated: new Date().toISOString(),
    stages: {
      assembly: { id: 'assembly', name: 'Assembly', subtext: 'Mechanical & Sub-Assembly Build', startSerial: 'PST20001', currentSerial: 'PST20129', targetSerial: 'PST20200', targetCount: 200, currentCount: 129 },
      ft: { id: 'ft', name: 'FT', fullName: 'Functional Testing', subtext: 'Automated QA & Diagnostics', startSerial: 'PST20001', currentSerial: 'PST20098', targetSerial: 'PST20200', targetCount: 200, currentCount: 98 },
      dlc: { id: 'dlc', name: 'DLC', fullName: 'Device Life Cycle', subtext: 'Final Calibration & Burn-In', startSerial: 'PST20001', currentSerial: 'PST20082', targetSerial: 'PST20200', targetCount: 200, currentCount: 82 }
    },
    logs: []
  });

  const [connected, setConnected] = useState(false);
  const [socket, setSocket] = useState(null);
  const [lastPulseStage, setLastPulseStage] = useState(null);

  // Initialize Socket connection
  useEffect(() => {
    const socketInstance = io(window.location.origin, {
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling']
    });

    socketInstance.on('connect', () => {
      console.log('Socket connected successfully:', socketInstance.id);
      setConnected(true);
    });

    socketInstance.on('disconnect', () => {
      console.log('Socket disconnected');
      setConnected(false);
    });

    socketInstance.on('initial_state', (state) => {
      if (state && state.stages) {
        setData(state);
      }
    });

    socketInstance.on('production_updated', (updatedState) => {
      if (updatedState && updatedState.stages) {
        setData(updatedState);
      }
    });

    socketInstance.on('stage_pulse', ({ stage }) => {
      setLastPulseStage(stage);
      setTimeout(() => {
        setLastPulseStage(null);
      }, 800);
    });

    setSocket(socketInstance);

    // Initial fetch fallback
    fetch('/api/production')
      .then(res => res.json())
      .then(res => {
        if (res.success && res.data) {
          setData(res.data);
        }
      })
      .catch(err => console.log('REST fallback fetch:', err.message));

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  // Quick increment action
  const incrementCount = useCallback((stage, delta = 1, operator = 'Station Admin') => {
    if (socket && connected) {
      socket.emit('increment_count', { stage, delta, operator });
    } else {
      fetch('/api/production/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage, delta, operator })
      })
        .then(res => res.json())
        .then(res => {
          if (res.success) setData(res.data);
        });
    }
  }, [socket, connected]);

  // Set explicit serial numbers
  const setStageSerial = useCallback(({ stage, currentSerial, targetSerial, startSerial, operator = 'Admin Panel' }) => {
    if (socket && connected) {
      socket.emit('set_stage_serial', { stage, currentSerial, targetSerial, startSerial, operator });
    } else {
      fetch('/api/production/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage, currentSerial, targetSerial, startSerial, operator })
      })
        .then(res => res.json())
        .then(res => {
          if (res.success) setData(res.data);
        });
    }
  }, [socket, connected]);

  // Batch update
  const batchUpdate = useCallback((stages, shift, operator = 'Admin Batch') => {
    fetch('/api/production/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stages, shift, operator })
    })
      .then(res => res.json())
      .then(res => {
        if (res.success) setData(res.data);
      });
  }, []);

  // Reset shift or day
  const resetProduction = useCallback((params) => {
    fetch('/api/production/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    })
      .then(res => res.json())
      .then(res => {
        if (res.success) setData(res.data);
      });
  }, []);

  // Set Shift
  const setShift = useCallback((shift) => {
    if (socket && connected) {
      socket.emit('set_shift', { shift });
    } else {
      fetch('/api/production/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shift })
      })
        .then(res => res.json())
        .then(res => {
          if (res.success) setData(res.data);
        });
    }
  }, [socket, connected]);

  return (
    <ProductionContext.Provider
      value={{
        data,
        connected,
        lastPulseStage,
        incrementCount,
        setStageSerial,
        batchUpdate,
        resetProduction,
        setShift
      }}
    >
      {children}
    </ProductionContext.Provider>
  );
};

export const useProduction = () => {
  const context = useContext(ProductionContext);
  if (!context) {
    throw new Error('useProduction must be used within a ProductionProvider');
  }
  return context;
};
