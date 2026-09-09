import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL, getApiUrl } from '../config/api';

const ProductionContext = createContext(null);

export const ProductionProvider = ({ children }) => {
  const [data, setData] = useState({
    productName: 'PROTEUS',
    prefix: 'PST',
    startNum: 20001,
    dailyTarget: 50,
    shift: '',
    lastUpdated: '',
    units: [],
    stages: {
      assembly: { id: 'assembly', name: 'Assembly', subtext: 'Mechanical & Sub-Assembly Build', doneCount: 0, totalCount: 50, startSerial: '', endSerial: '' },
      ft: { id: 'ft', name: 'FT', fullName: 'Functional Testing', subtext: 'Automated QA & Diagnostics', doneCount: 0, totalCount: 50, startSerial: '', endSerial: '' },
      dlc: { id: 'dlc', name: 'DLC', fullName: 'Device Life Cycle', subtext: 'Final Calibration & Burn-In', doneCount: 0, totalCount: 50, startSerial: '', endSerial: '' },
      oqc: { id: 'oqc', name: 'OQC', fullName: 'Outgoing Quality Control', subtext: 'Inspection & Compliance', doneCount: 0, totalCount: 50, startSerial: '', endSerial: '' },
      shipment: { id: 'shipment', name: 'Shipment', fullName: 'Shipment & Dispatch', subtext: 'Packaging & Logistics Dispatch', doneCount: 0, totalCount: 50, startSerial: '', endSerial: '' }
    }
  });

  const [connected, setConnected] = useState(false);
  const [socket, setSocket] = useState(null);

  // Initialize Socket connection
  useEffect(() => {
    const socketInstance = io(SOCKET_URL, {
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling']
    });

    socketInstance.on('connect', () => {
      console.log('Socket connected:', socketInstance.id);
      setConnected(true);
    });

    socketInstance.on('disconnect', () => {
      console.log('Socket disconnected');
      setConnected(false);
    });

    socketInstance.on('initial_state', (state) => {
      if (state && state.units) {
        setData(state);
      }
    });

    socketInstance.on('production_updated', (updatedState) => {
      if (updatedState && updatedState.units) {
        setData(updatedState);
      }
    });

    setSocket(socketInstance);

    // One-time initial fetch on mount
    fetch(getApiUrl('/api/production'))
      .then(res => res.json())
      .then(res => {
        if (res.success && res.data && res.data.units) {
          setData(res.data);
        }
      })
      .catch(err => console.log('Initial fetch error:', err.message));

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  // Toggle a unit's status at a stage
  const updateUnitStatus = useCallback((serial, stage, status) => {
    return fetch(getApiUrl('/api/production/unit/status'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serial, stage, status })
    })
      .then(res => res.json())
      .then(res => {
        if (res.success && res.data) {
          setData(res.data);
        }
        return res;
      })
      .catch(err => {
        console.error(`Error updating ${serial} at ${stage}:`, err.message);
        // WebSocket fallback
        if (socket && connected) {
          socket.emit('update_unit_status', { serial, stage, status });
        }
      });
  }, [socket, connected]);

  // Configure daily batch
  const configureBatch = useCallback((startNum, dailyTarget, prefix) => {
    return fetch(getApiUrl('/api/production/configure'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startNum, dailyTarget, prefix })
    })
      .then(res => res.json())
      .then(res => {
        if (res.success && res.data) {
          setData(res.data);
        }
        return res;
      });
  }, []);

  return (
    <ProductionContext.Provider
      value={{
        data,
        connected,
        updateUnitStatus,
        configureBatch
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
