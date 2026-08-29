import React, { useState, useEffect } from 'react';
import { ProductionProvider } from './context/ProductionContext';
import { Dashboard } from './components/Dashboard';
import { AdminPanel } from './components/AdminPanel';
import { AdminLogin } from './components/AdminLogin';

export function App() {
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard' | 'admin'
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

  // Handle URL routing / deep linking (e.g. /admin or #admin)
  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      if (path === '/admin' || hash === '#admin') {
        setCurrentView('admin');
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

  const handleLoginSuccess = (user) => {
    setIsAuthenticated(true);
    setAdminUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('proteus_admin_token');
    localStorage.removeItem('proteus_admin_user');
    setIsAuthenticated(false);
    setAdminUser(null);
  };

  return (
    <ProductionProvider>
      {currentView === 'dashboard' ? (
        <Dashboard onOpenAdmin={navigateToAdmin} />
      ) : isAuthenticated ? (
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
      )}
    </ProductionProvider>
  );
}

export default App;

