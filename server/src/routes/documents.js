import express from 'express';
import pool from '../config/database.js';
import { authenticate, checkPermission } from '../middleware/auth.js';
import path from 'path';
import fs from 'fs';

// Puppeteer is optional (not available in Railway cloud)
let puppeteer = null;
let puppeteerLoaded = false;

async function getPuppeteer() {
    if (puppeteerLoaded) return puppeteer;
    puppeteerLoaded = true;
    try {
        const puppeteerModule = await import('puppeteer');
        puppeteer = puppeteerModule.default;
        console.log('Puppeteer loaded successfully');
    } catch (e) {
        console.warn('Puppeteer not available - PDF generation disabled');
        puppeteer = null;
    }
    return puppeteer;
}

const router = express.Router();

/**
 * Генерация PDF для ТОРГ-12
 */
router.post('/generate-torg12/:saleId', authenticate, checkPermission('documents.generate'), async (req, res) => {
    let browser;

    try {
        const { saleId } = req.params;
        const { format = 'pdf' } = req.query; // pdf or html

        // Получить данные для ТОРГ-12
        const dataResult = await pool.query('SELECT get_torg12_data($1) as data', [saleId]);
        const data = dataResult.rows[0].data;

        if (!data) {
            return res.status(404).json({ error: 'Sale not found' });
        }

        // Получить шаблон
        const templateResult = await pool.query(`
            SELECT template_content, header_content, footer_content, styles
            FROM document_templates dt
            JOIN document_types dty ON dt.document_type_id = dty.id
            WHERE dty.code = 'torg12' AND dt.is_default = true
            LIMIT 1
        `);

        if (templateResult.rows.length === 0) {
            return res.status(404).json({ error: 'Template not found' });
        }

        const template = templateResult.rows[0];

        // Заменить переменные
        let html = template.template_content;

        // Заменить простые переменные
        Object.keys(data).forEach(key => {
            if (typeof data[key] !== 'object' && data[key] !== null) {
                const regex = new RegExp(`{{${key}}}`, 'g');
                html = html.replace(regex, data[key]);
            }
        });

        // Заменить items_rows
        if (data.items && Array.isArray(data.items)) {
            const itemsRows = data.items.map(item => `
                <tr>
                    <td>${item.number || ''}</td>
                    <td>${item.name || ''}</td>
                    <td>${item.unit || ''}</td>
                    <td>${item.quantity || 0}</td>
                    <td>${parseFloat(item.price || 0).toFixed(2)}</td>
                    <td>${parseFloat(item.amount || 0).toFixed(2)}</td>
                </tr>
            `).join('');
            html = html.replace('{{items_rows}}', itemsRows);
        }

        // Если запросили HTML - сразу вернуть
        if (format === 'html') {
            return res.send(html);
        }

        // Генерация PDF с puppeteer
        const pup = await getPuppeteer();
        if (!pup) {
            return res.status(503).json({
                error: 'PDF generation not available on this server. Use format=html instead.',
                suggestion: 'Add ?format=html to the request'
            });
        }

        browser = await pup.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setContent(html, {
            waitUntil: 'networkidle0'
        });

        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20mm',
                right: '10mm',
                bottom: '20mm',
                left: '10mm'
            }
        });

        await browser.close();
        browser = null;

        // Сохранить запись о генерации
        await pool.query(`
            INSERT INTO generated_documents (
                document_type_id, source_table, source_id, document_number, 
                document_date, file_format, generated_by
            )
            SELECT 
                dty.id, 'sales', $1, $2, $3, 'PDF', $4
            FROM document_types dty
            WHERE dty.code = 'torg12'
        `, [saleId, data.document_number, data.document_date, req.user.userId]);

        // Вернуть PDF
        res.contentType('application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="TORG-12_${data.document_number}.pdf"`);
        res.send(pdf);

    } catch (error) {
        console.error('Error generating document:', error);

        if (browser) {
            await browser.close().catch(err => console.error('Error closing browser:', err));
        }

        res.status(500).json({ error: error.message });
    }
});

/**
 * Список сгенерированных документов
 */
router.get('/generated', authenticate, async (req, res) => {
    try {
        const { limit = 100 } = req.query;

        const result = await pool.query(`
            SELECT 
                gd.*,
                dty.name as document_type_name,
                dty.code as document_type_code,
                u.full_name as generated_by_name
            FROM generated_documents gd
            JOIN document_types dty ON gd.document_type_id = dty.id
            LEFT JOIN users u ON gd.generated_by = u.id
            ORDER BY gd.generated_at DESC
            LIMIT $1
        `, [limit]);

        // Filter by license_id if available
        const userLicenseId = req.user?.license_id;
        const filteredRows = userLicenseId
            ? result.rows.filter(r => r.license_id === userLicenseId || !r.license_id)
            : result.rows;

        res.json(filteredRows);
    } catch (error) {
        console.error('Error fetching documents:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Получить реквизиты организации
 */
router.get('/organization', authenticate, async (req, res) => {
    try {
        const userLicenseId = req.user?.license_id;
        let query = 'SELECT * FROM organization_details';
        const params = [];
        if (userLicenseId) {
            query += ' WHERE license_id = $1';
            params.push(userLicenseId);
        }
        query += ' LIMIT 1';
        const result = await pool.query(query, params);
        res.json(result.rows[0] || {});
    } catch (error) {
        console.error('Error fetching organization:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Обновить реквизиты организации
 */
router.put('/organization', authenticate, checkPermission('admin.settings'), async (req, res) => {
    try {
        const {
            full_name, short_name, inn, kpp, ogrn,
            legal_address, actual_address, phone, email, website,
            director_name, director_position,
            accountant_name,
            bank_name, bank_bik, bank_account, correspondent_account
        } = req.body;

        const result = await pool.query(`
            UPDATE organization_details
            SET 
                full_name = $1, short_name = $2, inn = $3, kpp = $4, ogrn = $5,
                legal_address = $6, actual_address = $7, phone = $8, email = $9, website = $10,
                director_name = $11, director_position = $12,
                accountant_name = $13,
                bank_name = $14, bank_bik = $15, bank_account = $16, correspondent_account = $17,
                updated_at = NOW()
            RETURNING *
        `, [
            full_name, short_name, inn, kpp, ogrn,
            legal_address, actual_address, phone, email, website,
            director_name, director_position,
            accountant_name,
            bank_name, bank_bik, bank_account, correspondent_account
        ]);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating organization:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
