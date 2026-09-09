const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const port = typeof window !== 'undefined' ? window.location.port : '';

// API Base URL resolution:
// 1. Custom env var VITE_API_URL if configured
// 2. If dev server on port 3000 or 5173, backend is on port 5000 on the same host (supports localhost and LAN IP)
// 3. Otherwise, use current origin or fallback
// export const API_BASE_URL = (
//   import.meta.env.VITE_API_URL ||
//   (typeof window !== 'undefined'
//     ? (port === '3000' || port === '5173'
//         ? `http://${hostname}:5000`
//         : window.location.origin)
//     : 'http://localhost:5000')
// ).replace(/\/$/, '');

export const API_BASE_URL = 'http://localhost:5000';
// Socket.io URL resolution
export const SOCKET_URL = (
  import.meta.env.VITE_SOCKET_URL ||
  API_BASE_URL
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
