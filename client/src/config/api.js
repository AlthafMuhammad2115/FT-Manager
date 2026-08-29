// Backend API & WebSocket Configuration
const isProduction = import.meta.env.PROD;

// Default production backend hosted on Render
const DEFAULT_RENDER_BACKEND = 'https://ft-manager.onrender.com';

// API Base URL resolution:
// 1. Custom env var VITE_API_URL if configured (e.g. in Vercel project settings)
// 2. Default Render backend URL in production
// 3. Empty string in local dev (relies on Vite proxy to http://localhost:5000)
export const API_BASE_URL = (
  import.meta.env.VITE_API_URL ||
  (isProduction ? DEFAULT_RENDER_BACKEND : '')
).replace(/\/$/, '');

// Socket.io URL resolution
export const SOCKET_URL = (
  import.meta.env.VITE_SOCKET_URL ||
  import.meta.env.VITE_API_URL ||
  (isProduction ? DEFAULT_RENDER_BACKEND : (typeof window !== 'undefined' ? window.location.origin : ''))
).replace(/\/$/, '');

/**
 * Returns full URL for an API endpoint
 * @param {string} endpoint - e.g. '/api/production'
 * @returns {string} - full URL
 */
export const getApiUrl = (endpoint) => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${cleanEndpoint}`;
};
