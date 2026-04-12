import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    base: './',
    define: {
        'process.env': {}
    },
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        emptyOutDir: true
    },
    server: {
        port: 3000,
        proxy: {
            '/license-api': {
                target: 'https://smartpos-pro-production.up.railway.app',
                changeOrigin: true,
                secure: true,
                rewrite: (path) => path.replace(/^\/license-api/, '/api'),
            },
            '/api': {
                target: 'http://localhost:5000',
                changeOrigin: true
            }
        }
    }
});
