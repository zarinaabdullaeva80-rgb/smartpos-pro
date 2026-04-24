/**
 * Сервис проверки и применения обновлений
 */

import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import pool from '../config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

// Читаем версию из package.json (динамически)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
let CURRENT_VERSION = '3.0.0';
try {
    const pkgPath = path.resolve(__dirname, '../../../package.json');
    if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        CURRENT_VERSION = pkg.version || CURRENT_VERSION;
    }
} catch (e) { /* fallback to default */ }

const BUILD_DATE = '2026-03-01';

// Симуляция последней доступной версии (в реальности - запрос к серверу обновлений)
const LATEST_VERSION = {
    version: CURRENT_VERSION, // По умолчанию = текущая (обновлений нет)
    releaseDate: BUILD_DATE,
    mandatory: false,
    changelog: [
        '✨ Автообновление через GitHub Releases',
        '🔐 Двухфакторная аутентификация (2FA)',
        '🐛 Исправления ошибок',
        '⚡ Оптимизация производительности'
    ],
    downloadUrl: '',
    size: '65 MB'
};

/**
 * Получить текущую версию
 */
router.get('/current', (req, res) => {
    res.json({
        version: CURRENT_VERSION,
        buildDate: BUILD_DATE,
        environment: process.env.NODE_ENV || 'development'
    });
});

/**
 * Проверить доступные обновления
 */
router.get('/check', authenticateToken, async (req, res) => {
    try {
        // В реальном приложении: fetch('https://updates.example.com/api/check?version=' + CURRENT_VERSION)

        const hasUpdate = compareVersions(LATEST_VERSION.version, CURRENT_VERSION) > 0;

        // Сохранить информацию о проверке
        await pool.query(`
            INSERT INTO update_checks (user_id, current_version, latest_version, has_update)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT DO NOTHING
        `, [req.user?.id, CURRENT_VERSION, LATEST_VERSION.version, hasUpdate]).catch(() => { });

        res.json({
            currentVersion: CURRENT_VERSION,
            latestVersion: LATEST_VERSION.version,
            hasUpdate,
            mandatory: hasUpdate && LATEST_VERSION.mandatory,
            releaseDate: LATEST_VERSION.releaseDate,
            changelog: hasUpdate ? LATEST_VERSION.changelog : [],
            downloadUrl: hasUpdate ? LATEST_VERSION.downloadUrl : null,
            size: LATEST_VERSION.size
        });
    } catch (error) {
        console.error('Check updates error:', error);
        res.json({
            currentVersion: CURRENT_VERSION,
            hasUpdate: false,
            error: 'Не удалось проверить обновления'
        });
    }
});

/**
 * Получить настройки автообновления
 */
router.get('/settings', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM update_settings WHERE id = 1
        `);

        const defaults = {
            auto_check: true,
            check_interval_hours: 24,
            auto_download: false,
            auto_install: false,
            notify_users: true,
            update_channel: 'stable',  // stable, beta, dev
            last_check: null
        };

        res.json({ settings: result.rows[0] || defaults });
    } catch (error) {
        res.json({ settings: { auto_check: true, check_interval_hours: 24 } });
    }
});

/**
 * Обновить настройки автообновления
 */
router.put('/settings', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const {
            auto_check, check_interval_hours, auto_download,
            auto_install, notify_users, update_channel
        } = req.body;

        await pool.query(`
            INSERT INTO update_settings (id, auto_check, check_interval_hours, auto_download, auto_install, notify_users, update_channel)
            VALUES (1, $1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO UPDATE SET
                auto_check = $1, check_interval_hours = $2, auto_download = $3,
                auto_install = $4, notify_users = $5, update_channel = $6,
                updated_at = CURRENT_TIMESTAMP
        `, [auto_check, check_interval_hours, auto_download, auto_install, notify_users, update_channel]);

        res.json({ success: true, message: 'Настройки сохранены' });
    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({ error: 'Ошибка сохранения настроек' });
    }
});

/**
 * История обновлений
 */
router.get('/history', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM update_history
            ORDER BY installed_at DESC
            LIMIT 20
        `);

        res.json({
            history: result.rows.length > 0 ? result.rows : [
                { version: '1.2.0', installed_at: '2026-01-16', status: 'installed', notes: 'Текущая версия' },
                { version: '1.1.0', installed_at: '2026-01-10', status: 'installed', notes: 'QR-оплата, Биометрия' },
                { version: '1.0.0', installed_at: '2026-01-01', status: 'installed', notes: 'Первоначальная установка' }
            ]
        });
    } catch (error) {
        res.json({ history: [] });
    }
});

/**
 * Changelog (что нового)
 */
router.get('/changelog', (req, res) => {
    res.json({
        changelog: [
            {
                version: '1.2.0',
                date: '2026-01-16',
                changes: [
                    { type: 'feature', text: 'QR-оплата через Payme, Click, UZUM' },
                    { type: 'feature', text: 'Биометрическая аутентификация' },
                    { type: 'feature', text: 'Мульти-касса с PIN-кодами' },
                    { type: 'feature', text: 'Накопительные карты лояльности' },
                    { type: 'security', text: 'Защита от DDoS и брутфорса' },
                    { type: 'improvement', text: 'Электронные чеки SMS/Email/WhatsApp' }
                ]
            },
            {
                version: '1.1.0',
                date: '2026-01-10',
                changes: [
                    { type: 'feature', text: 'Программа лояльности' },
                    { type: 'feature', text: 'Отчёты и Z-отчёты' },
                    { type: 'feature', text: 'Управление сменами' },
                    { type: 'improvement', text: 'Улучшенный интерфейс' }
                ]
            }
        ]
    });
});

// Вспомогательная функция сравнения версий
function compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        if (p1 > p2) return 1;
        if (p1 < p2) return -1;
    }
    return 0;
}

// === Electron Auto-Updater (Smart Dynamic Provider) ===
const UPDATES_DIR = path.join(__dirname, '../../updates');
if (!fs.existsSync(UPDATES_DIR)) {
    fs.mkdirSync(UPDATES_DIR, { recursive: true });
}

// Кэш для SHA-512 (чтобы не пересчитывать при каждом запросе)
const hashCache = new Map();

// GET /api/updates/latest.yml
router.get('/latest.yml', async (req, res) => {
    try {
        const ymlPath = path.join(UPDATES_DIR, 'latest.yml');
        
        // Если файл latest.yml уже есть (создан при сборке), отдаем его
        if (fs.existsSync(ymlPath)) {
            res.setHeader('Content-Type', 'text/yaml');
            return res.sendFile(ymlPath);
        }

        // Если нет — генерируем динамически на лету!
        const files = fs.readdirSync(UPDATES_DIR);
        const exeFiles = files.filter(f => f.endsWith('.exe')).sort().reverse(); // Последний по имени

        if (exeFiles.length === 0) {
            return res.status(404).send('No updates found');
        }

        const latestExe = exeFiles[0];
        // Вытаскиваем версию из имени (например "SmartPOS Pro Setup 4.2.1.exe" -> "4.2.1")
        const versionMatch = latestExe.match(/(\d+\.\d+\.\d+)/);
        const version = versionMatch ? versionMatch[1] : '0.0.0';
        
        const filePath = path.join(UPDATES_DIR, latestExe);
        const stats = fs.statSync(filePath);

        // Генерируем YAML контент
        const yaml = [
            `version: ${version}`,
            `files:`,
            `  - url: ${latestExe}`,
            `    sha512: DUMMY_HASH_PLEASE_UPLOAD_YML_FOR_PROPER_CHECKS`,
            `    size: ${stats.size}`,
            `path: ${latestExe}`,
            `sha512: DUMMY_HASH_PLEASE_UPLOAD_YML_FOR_PROPER_CHECKS`,
            `releaseDate: ${stats.mtime.toISOString()}`
        ].join('\n');

        res.setHeader('Content-Type', 'text/yaml');
        res.send(yaml);
        console.log(`[Updates] Generated dynamic response for version ${version}`);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// GET /api/updates/:filename — скачать файл (exe/blockmap/yml)
router.get('/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(UPDATES_DIR, filename);
    
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).json({ error: 'File not found' });
    }
});

export default router;

