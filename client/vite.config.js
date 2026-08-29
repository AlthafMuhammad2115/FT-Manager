import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'https://ft-manager.onrender.com',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'https://ft-manager.onrender.com',
        ws: true,
      },
    },
  },
});
