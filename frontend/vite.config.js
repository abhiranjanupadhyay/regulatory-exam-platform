import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the UI proxies /api to the gateway so no CORS setup is needed.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: { '/api': process.env.VITE_GATEWAY_URL || 'http://localhost:8080' },
  },
});
