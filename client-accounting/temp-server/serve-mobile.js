import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.MOBILE_PORT || 8082;

// Путь к экспортированному мобильному приложению
const distPath = process.env.MOBILE_DIST_PATH || path.resolve(__dirname, '..', 'mpos', 'dist');

if (!fs.existsSync(distPath)) {
    console.error('[Mobile] dist path not found:', distPath);
    console.error('[Mobile] Run: cd mpos && npx expo export --platform web');
    process.exit(1);
}

console.log('[Mobile] Serving from:', distPath);

// Apple PWA meta tags
app.use((req, res, next) => {
    // Allow CORS for API requests from mobile
    res.header('Access-Control-Allow-Origin', '*');
    next();
});

// Serve static files
app.use(express.static(distPath, { maxAge: '7d' }));

// SPA fallback — any non-file request gets index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`📱 Mobile PWA доступно: http://localhost:${PORT}`);
    console.log(`🌐 Доступно в сети на порту ${PORT}`);
});
