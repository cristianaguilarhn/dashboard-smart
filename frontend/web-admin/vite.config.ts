import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/solapp-api': {
        target: 'https://solapp.arsa.hn',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/solapp-api/, ''),
      },
      '/api': {
        target: 'http://localhost:5198',
        changeOrigin: true,
      },
    },
  }
});
