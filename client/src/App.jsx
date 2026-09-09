import React, { useState, useEffect } from 'react';
import { ProductionProvider } from './context/ProductionContext';
import { Dashboard } from './components/Dashboard';
import { AdminPanel } from './components/AdminPanel';
import { AdminLogin } from './components/AdminLogin';
import { LiveStatus } from './components/LiveStatus';

export function App() {
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard' | 'admin' | 'live'
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminUser, setAdminUser] = useState(null);

  // Check initial authentication token
  useEffect(() => {
    const token = localStorage.getItem('proteus_admin_token');
    const storedUser = localStorage.getItem('proteus_admin_user');
    if (token) {
      setIsAuthenticated(true);
      if (storedUser) {
        try {
          setAdminUser(JSON.parse(storedUser));
        } catch (e) {
          setAdminUser({ username: 'admin' });
        }
      }
    }
  }, []);

  // Handle URL routing / deep linking (e.g. /admin or #admin, /live or #live)
  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      if (path === '/admin' || hash === '#admin') {
        setCurrentView('admin');
      } else if (path === '/live' || hash === '#live') {
        setCurrentView('live');
      } else {
        setCurrentView('dashboard');
      }
    };

    handleLocationChange();
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  const navigateToAdmin = () => {
    window.location.hash = 'admin';
    setCurrentView('admin');
  };

  const navigateToDashboard = () => {
    window.location.hash = '';
    setCurrentView('dashboard');
  };

  const navigateToLive = () => {
    window.location.hash = 'live';
    setCurrentView('live');
  };

  const handleLoginSuccess = (user) => {
    setIsAuthenticated(true);
    setAdminUser(user);
    navigateToAdmin();
  };

  const handleLogout = () => {
    localStorage.removeItem('proteus_admin_token');
    localStorage.removeItem('proteus_admin_user');
    setIsAuthenticated(false);
    setAdminUser(null);
    navigateToDashboard();
  };

  return (
    <ProductionProvider>
      {currentView === 'admin' ? (
        isAuthenticated ? (
          <AdminPanel
            adminUser={adminUser}
            onBackToDashboard={navigateToDashboard}
            onLogout={handleLogout}
          />
        ) : (
          <AdminLogin
            onLoginSuccess={handleLoginSuccess}
            onCancel={navigateToDashboard}
          />
        )
      ) : currentView === 'live' ? (
        <LiveStatus onBackToDashboard={navigateToDashboard} />
      ) : (
        <Dashboard onOpenAdmin={navigateToAdmin} onOpenLive={navigateToLive} />
      )}
    </ProductionProvider>
  );
}

export default App;

