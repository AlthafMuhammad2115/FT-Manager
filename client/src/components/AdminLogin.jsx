import React, { useState } from 'react';
import { ShieldCheck, Lock, User, Eye, EyeOff, ArrowLeft, AlertCircle } from 'lucide-react';
import { getApiUrl } from '../config/api';

export const AdminLogin = ({ onLoginSuccess, onCancel }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMessage('Please enter both username and password.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const response = await fetch(getApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim()
        })
      });

      const resData = await response.json();

      if (response.ok && resData.success) {
        localStorage.setItem('proteus_admin_token', resData.token);
        localStorage.setItem('proteus_admin_user', JSON.stringify(resData.user));
        onLoginSuccess(resData.user);
      } else {
        setErrorMessage(resData.message || 'Invalid username or password.');
      }
    } catch (err) {
      // Fallback local verification if server is unreachable
      if (
        (username.trim().toLowerCase() === 'admin_user') &&
        (password.trim() === 'admin_pass')
      ) {
        const dummyUser = { username: 'admin_user', role: 'Supervisor / Administrator' };
        localStorage.setItem('proteus_admin_token', 'local-token-' + Date.now());
        localStorage.setItem('proteus_admin_user', JSON.stringify(dummyUser));
        onLoginSuccess(dummyUser);
      } else {
        setErrorMessage('Authentication failed. Check credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-overlay">
      <div className="login-backdrop" onClick={onCancel} />
      
      <div className="login-card">
        {/* Top Glow & Header */}
        <div className="login-card-header">
          <div className="login-icon-badge">
            <ShieldCheck size={32} />
          </div>
          <h2>Admin Authentication</h2>
          <p>Restricted access for Proteus line supervisors & engineers</p>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="login-error-badge">
            <AlertCircle size={18} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="login-form" autoComplete="off">
          <div className="login-field-group">
            <label htmlFor="login-username">
              <User size={15} />
              <span>Username</span>
            </label>
            <div className="login-input-wrapper">
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username..."
                autoFocus
                autoComplete="off"
                required
              />
            </div>
          </div>

          <div className="login-field-group">
            <label htmlFor="login-password">
              <Lock size={15} />
              <span>Password</span>
            </label>
            <div className="login-input-wrapper">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password..."
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="login-actions">
            <button
              type="submit"
              className="btn-login-submit"
              disabled={loading}
            >
              {loading ? (
                <span>Verifying...</span>
              ) : (
                <>
                  <Lock size={18} />
                  <span>Unlock Admin Console</span>
                </>
              )}
            </button>

            <button
              type="button"
              className="btn-login-back"
              onClick={onCancel}
            >
              <ArrowLeft size={16} />
              <span>Return to TV Display</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
