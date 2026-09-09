import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL, getApiUrl } from '../config/api';

const ProductionContext = createContext(null);

export const ProductionProvider = ({ children }) => {
  const [data, setData] = useState({
    productName: 'PROTEUS',
    shift: '',
    lastUpdated: '',
    stages: {
      assembly: { id: 'assembly', name: 'Assembly', subtext: 'Mechanical & Sub-Assembly Build', startSerial: '', currentSerial: '', targetSerial: '', targetCount: 0, currentCount: 0 },
      ft: { id: 'ft', name: 'FT', fullName: 'Functional Testing', subtext: 'Automated QA & Diagnostics', startSerial: '', currentSerial: '', targetSerial: '', targetCount: 0, currentCount: 0 },
      dlc: { id: 'dlc', name: 'DLC', fullName: 'Device Life Cycle', subtext: 'Final Calibration & Burn-In', startSerial: '', currentSerial: '', targetSerial: '', targetCount: 0, currentCount: 0 }
    }
  });

  const [connected, setConnected] = useState(false);
  const [socket, setSocket] = useState(null);
  const [lastPulseStage, setLastPulseStage] = useState(null);

  // Initialize Socket connection
  useEffect(() => {
    const socketInstance = io(SOCKET_URL, {
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

    // One-time initial fetch on mount (subsequent updates arrive via WebSocket)
    fetch(getApiUrl('/api/production'))
      .then(res => res.json())
      .then(res => {
        if (res.success && res.data && res.data.stages) {
          setData(res.data);
        }
      })
      .catch(err => console.log('Initial fetch error:', err.message));

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  // Quick increment action: Calls POST /api/production/:stage/increment
  const incrementCount = useCallback((stage, delta = 1, operator = 'Station Admin') => {
    fetch(getApiUrl(`/api/production/${stage}/increment`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delta, operator })
    })
      .then(res => res.json())
      .then(res => {
        if (res.success && res.data) {
          setData(res.data);
        }
      })
      .catch(err => {
        console.error(`Error incrementing ${stage}:`, err.message);
        if (socket && connected) {
          socket.emit('increment_count', { stage, delta, operator });
        }
      });
  }, [socket, connected]);

  // Set explicit serial numbers: Calls POST /api/production/:stage/set
  const setStageSerial = useCallback(({ stage, currentSerial, targetSerial, startSerial, operator = 'Admin Panel' }) => {
    fetch(getApiUrl(`/api/production/${stage}/set`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentSerial, targetSerial, startSerial, operator })
    })
      .then(res => res.json())
      .then(res => {
        if (res.success && res.data) {
          setData(res.data);
        }
      })
      .catch(err => {
        console.error(`Error setting ${stage} serials:`, err.message);
        if (socket && connected) {
          socket.emit('set_stage_serial', { stage, currentSerial, targetSerial, startSerial, operator });
        }
      });
  }, [socket, connected]);

  // Dedicated Assembly Target Setter: Calls POST /api/production/assembly/target
  const setAssemblyTarget = useCallback((targetSerial) => {
    return fetch(getApiUrl('/api/production/assembly/target'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetSerial })
    })
      .then(res => res.json())
      .then(res => {
        if (res.success && res.data) {
          setData(res.data);
        }
        return res;
      });
  }, []);

  // Batch update
  const batchUpdate = useCallback((stages, shift, operator = 'Admin Batch') => {
    fetch(getApiUrl('/api/production/batch'), {
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
    fetch(getApiUrl('/api/production/reset'), {
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
      fetch(getApiUrl('/api/production/update'), {
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
        setAssemblyTarget,
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
