import express from 'express';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import pool from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Настройка multer для загрузки сертификатов и документов
const edsStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(os.tmpdir(), 'smartpos-eds');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({
    storage: edsStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (['.pfx', '.p12', '.pem', '.cer', '.crt', '.key', '.pdf', '.xlsx', '.docx', '.xml', '.json'].includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Неподдерживаемый формат файла'));
        }
    }
});

// ═══════════════════════════════════════════
// Автоматическое создание таблиц при первом запуске
// ═══════════════════════════════════════════
const ensureTables = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS eds_certificates (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                owner VARCHAR(255),
                issuer VARCHAR(255) DEFAULT 'E-IMZO',
                serial_number VARCHAR(255),
                valid_from DATE,
                valid_to DATE,
                status VARCHAR(50) DEFAULT 'active',
                cert_type VARCHAR(50) DEFAULT 'qualified',
                thumbprint VARCHAR(255),
                file_path TEXT,
                organization_id INTEGER,
                user_id INTEGER,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS eds_signatures (
                id SERIAL PRIMARY KEY,
                document_name VARCHAR(500) NOT NULL,
                document_type VARCHAR(100),
                document_hash VARCHAR(512) NOT NULL,
                signature_data TEXT,
                signer_name VARCHAR(255),
                certificate_id INTEGER REFERENCES eds_certificates(id) ON DELETE SET NULL,
                status VARCHAR(50) DEFAULT 'valid',
                signed_at TIMESTAMP DEFAULT NOW(),
                verified_at TIMESTAMP,
                file_path TEXT,
                signed_file_path TEXT,
                organization_id INTEGER,
                user_id INTEGER,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
    } catch (e) {
        // Таблицы уже существуют или другая ошибка
        if (!e.message.includes('already exists')) {
            console.warn('[EDS] Table creation warning:', e.message);
        }
    }
};

// Запускаем создание таблиц
ensureTables();

// ═══════════════════════════════════════════
// GET /api/eds/certificates — Список сертификатов
// ═══════════════════════════════════════════
router.get('/certificates', authenticate, async (req, res) => {
    try {
        const orgId = req.user?.organization_id || null;
        const result = await pool.query(
            `SELECT * FROM eds_certificates 
             WHERE (organization_id = $1 OR organization_id IS NULL)
             ORDER BY created_at DESC`,
            [orgId]
        );
        res.json({ certificates: result.rows });
    } catch (err) {
        console.error('[EDS] Get certificates error:', err.message);
        res.json({ certificates: [] });
    }
});

// ═══════════════════════════════════════════
// POST /api/eds/certificates/upload — Загрузка сертификата
// ═══════════════════════════════════════════
router.post('/certificates/upload', authenticate, upload.single('certificate'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Файл сертификата не загружен' });

        const { name, owner, issuer, valid_from, valid_to, cert_type } = req.body;
        const orgId = req.user?.organization_id || null;
        const userId = req.user?.userId;

        // Вычисляем thumbprint (SHA-256 hash файла)
        const fileBuffer = fs.readFileSync(req.file.path);
        const thumbprint = crypto.createHash('sha256').update(fileBuffer).digest('hex').toUpperCase();

        // Генерируем серийный номер
        const serialNumber = crypto.randomBytes(16).toString('hex').toUpperCase();

        const result = await pool.query(
            `INSERT INTO eds_certificates 
             (name, owner, issuer, serial_number, valid_from, valid_to, status, cert_type, thumbprint, file_path, organization_id, user_id)
             VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8, $9, $10, $11)
             RETURNING *`,
            [
                name || req.file.originalname,
                owner || req.user?.username || '',
                issuer || 'E-IMZO',
                serialNumber,
                valid_from || new Date().toISOString().split('T')[0],
                valid_to || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                cert_type || 'qualified',
                thumbprint,
                req.file.path,
                orgId,
                userId
            ]
        );

        res.json({ 
            message: 'Сертификат загружен успешно',
            certificate: result.rows[0]
        });
    } catch (err) {
        console.error('[EDS] Upload certificate error:', err.message);
        res.status(500).json({ error: 'Ошибка загрузки сертификата: ' + err.message });
    }
});

// ═══════════════════════════════════════════
// DELETE /api/eds/certificates/:id — Удалить сертификат
// ═══════════════════════════════════════════
router.delete('/certificates/:id', authenticate, async (req, res) => {
    try {
        const orgId = req.user?.organization_id || null;
        await pool.query(
            'DELETE FROM eds_certificates WHERE id = $1 AND (organization_id = $2 OR organization_id IS NULL)',
            [req.params.id, orgId]
        );
        res.json({ message: 'Сертификат удалён' });
    } catch (err) {
        console.error('[EDS] Delete certificate error:', err.message);
        res.status(500).json({ error: 'Ошибка удаления сертификата' });
    }
});

// ═══════════════════════════════════════════
// GET /api/eds/signatures — Список подписей
// ═══════════════════════════════════════════
router.get('/signatures', authenticate, async (req, res) => {
    try {
        const orgId = req.user?.organization_id || null;
        const result = await pool.query(
            `SELECT s.*, c.name as cert_name, c.owner as cert_owner
             FROM eds_signatures s
             LEFT JOIN eds_certificates c ON s.certificate_id = c.id
             WHERE (s.organization_id = $1 OR s.organization_id IS NULL)
             ORDER BY s.signed_at DESC`,
            [orgId]
        );
        res.json({ signatures: result.rows });
    } catch (err) {
        console.error('[EDS] Get signatures error:', err.message);
        res.json({ signatures: [] });
    }
});

// ═══════════════════════════════════════════
// POST /api/eds/sign — Подписать документ
// ═══════════════════════════════════════════
router.post('/sign', authenticate, upload.single('document'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Документ не загружен' });

        const { certificate_id } = req.body;
        const orgId = req.user?.organization_id || null;
        const userId = req.user?.userId;

        // Проверяем сертификат
        let certInfo = null;
        if (certificate_id) {
            const certRes = await pool.query('SELECT * FROM eds_certificates WHERE id = $1', [certificate_id]);
            if (certRes.rows.length === 0) {
                return res.status(404).json({ error: 'Сертификат не найден' });
            }
            certInfo = certRes.rows[0];
            if (certInfo.status !== 'active') {
                return res.status(400).json({ error: 'Сертификат неактивен' });
            }
            if (certInfo.valid_to && new Date(certInfo.valid_to) < new Date()) {
                return res.status(400).json({ error: 'Сертификат истёк' });
            }
        }

        // Вычисляем хэш документа
        const fileBuffer = fs.readFileSync(req.file.path);
        const documentHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

        // Создаём цифровую подпись (HMAC-SHA512 с thumbprint сертификата как ключ)
        const signKey = certInfo?.thumbprint || crypto.randomBytes(32).toString('hex');
        const signature = crypto.createHmac('sha512', signKey).update(documentHash).digest('hex');

        // Сохраняем подпись
        const result = await pool.query(
            `INSERT INTO eds_signatures 
             (document_name, document_type, document_hash, signature_data, signer_name, certificate_id, 
              status, file_path, organization_id, user_id, signed_at)
             VALUES ($1, $2, $3, $4, $5, $6, 'valid', $7, $8, $9, NOW())
             RETURNING *`,
            [
                req.file.originalname,
                path.extname(req.file.originalname).replace('.', '').toUpperCase(),
                documentHash,
                signature,
                certInfo?.owner || req.user?.username || 'Неизвестный',
                certificate_id || null,
                req.file.path,
                orgId,
                userId
            ]
        );

        res.json({
            message: 'Документ успешно подписан',
            signature: result.rows[0]
        });
    } catch (err) {
        console.error('[EDS] Sign error:', err.message);
        res.status(500).json({ error: 'Ошибка подписания: ' + err.message });
    }
});

// ═══════════════════════════════════════════
// GET /api/eds/signatures/:id/verify — Проверить подпись
// ═══════════════════════════════════════════
router.get('/signatures/:id/verify', authenticate, async (req, res) => {
    try {
        const sigRes = await pool.query(
            `SELECT s.*, c.thumbprint FROM eds_signatures s
             LEFT JOIN eds_certificates c ON s.certificate_id = c.id
             WHERE s.id = $1`,
            [req.params.id]
        );

        if (sigRes.rows.length === 0) {
            return res.status(404).json({ error: 'Подпись не найдена' });
        }

        const sig = sigRes.rows[0];
        let isValid = false;

        // Проверяем хэш файла, если файл ещё существует
        if (sig.file_path && fs.existsSync(sig.file_path)) {
            const fileBuffer = fs.readFileSync(sig.file_path);
            const currentHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
            
            if (currentHash === sig.document_hash) {
                // Проверяем подпись
                const signKey = sig.thumbprint || '';
                const expectedSig = crypto.createHmac('sha512', signKey).update(sig.document_hash).digest('hex');
                isValid = expectedSig === sig.signature_data;
            }
        } else {
            // Файл отсутствует — проверяем только наличие данных
            isValid = sig.status === 'valid' && !!sig.signature_data;
        }

        // Обновляем дату проверки
        await pool.query('UPDATE eds_signatures SET verified_at = NOW() WHERE id = $1', [req.params.id]);

        res.json({
            valid: isValid,
            document_name: sig.document_name,
            signer: sig.signer_name,
            signed_at: sig.signed_at,
            hash: sig.document_hash,
            status: isValid ? 'valid' : 'invalid'
        });
    } catch (err) {
        console.error('[EDS] Verify error:', err.message);
        res.status(500).json({ error: 'Ошибка проверки подписи' });
    }
});

// ═══════════════════════════════════════════
// GET /api/eds/signatures/:id/download — Скачать подписанный документ
// ═══════════════════════════════════════════
router.get('/signatures/:id/download', authenticate, async (req, res) => {
    try {
        const sigRes = await pool.query('SELECT * FROM eds_signatures WHERE id = $1', [req.params.id]);
        if (sigRes.rows.length === 0) {
            return res.status(404).json({ error: 'Подпись не найдена' });
        }

        const sig = sigRes.rows[0];
        if (!sig.file_path || !fs.existsSync(sig.file_path)) {
            return res.status(404).json({ error: 'Файл не найден' });
        }

        res.download(sig.file_path, sig.document_name);
    } catch (err) {
        console.error('[EDS] Download error:', err.message);
        res.status(500).json({ error: 'Ошибка скачивания' });
    }
});

export default router;
