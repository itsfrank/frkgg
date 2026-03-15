import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        host: '0.0.0.0',
        port: 3001,
        hmr: {
            host: 'frk.localhost',
            clientPort: 443,
            protocol: 'wss',
        },
    },
    test: {
        environment: 'jsdom',
        setupFiles: './src/test/setup.ts',
    },
});
