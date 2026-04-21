import express from 'express';
import pool from '../config/database.js';
import { authenticate, checkPermission } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';

const router = express.Router();

// ============================================================================
// ВОРОНКА ПРОДАЖ (SALES PIPELINE)
// ============================================================================

/**
 * Получить этапы воронки
 */
router.get('/stages', authenticate, checkPermission('crm.read'), async (req, res) => {
    try {
        const orgId = req.user?.organization_id;
        let query = 'SELECT * FROM deal_stages WHERE is_active = true';
        const params = [];
        if (orgId) {
            query += ' AND organization_id = $1';
            params.push(orgId);
        }
        query += ' ORDER BY position';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching stages:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Получить список сделок
 */
router.get('/deals', authenticate, checkPermission('crm.read'), async (req, res) => {
    try {
        const { status, assigned_to, stage_id } = req.query;

        const orgId = req.user?.organization_id;
        let query = `
            SELECT d.*,
                c.name as customer_name,
                c.phone as customer_phone,
                ds.name as stage_name,
                ds.color as stage_color,
                u.full_name as assigned_name
            FROM deals d
            LEFT JOIN counterparties c ON d.customer_id = c.id
            LEFT JOIN deal_stages ds ON d.stage_id = ds.id
            LEFT JOIN users u ON d.assigned_to = u.id
            WHERE 1=1
        `;

        const params = [];
        let paramIndex = 1;

        if (orgId) {
            query += ` AND d.organization_id = $${paramIndex++}`;
            params.push(orgId);
        }

        if (status) {
            query += ` AND d.status = $${paramIndex++}`;
            params.push(status);
        }

        if (assigned_to) {
            query += ` AND d.assigned_to = $${paramIndex++}`;
            params.push(assigned_to);
        }

        if (stage_id) {
            query += ` AND d.stage_id = $${paramIndex++}`;
            params.push(stage_id);
        }

        query += ' ORDER BY d.created_at DESC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching deals:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Создать сделку
 */
router.post('/deals', authenticate, checkPermission('crm.manage'), auditLog('deal'), async (req, res) => {
    try {
        const {
            title, customer_id, stage_id, amount,
            expected_close_date, source, notes
        } = req.body;

        const orgId = req.user?.organization_id;

        // Verify customer and stage belong to license
        if (orgId) {
            if (customer_id) {
                const cCheck = await pool.query('SELECT 1 FROM counterparties WHERE id = $1 AND organization_id = $2', [customer_id, orgId]);
                if (cCheck.rows.length === 0) throw new Error('Клиент не найден в вашей организации');
            }
            if (stage_id) {
                const sCheck = await pool.query('SELECT 1 FROM deal_stages WHERE id = $1 AND organization_id = $2', [stage_id, orgId]);
                if (sCheck.rows.length === 0) throw new Error('Этап не найден в вашей организации');
            }
        }

        const result = await pool.query(`
            INSERT INTO deals (
                title, customer_id, stage_id, amount,
                expected_close_date, source, notes,
                assigned_to, created_by, organization_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `, [
            title, customer_id, stage_id, amount,
            expected_close_date, source, notes,
            req.user.userId, req.user.userId, orgId
        ]);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error creating deal:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Обновить сделку
 */
router.put('/deals/:id', authenticate, checkPermission('crm.manage'), async (req, res) => {
    try {
        const { id } = req.params;
        const fields = [];
        const values = [];
        let paramIndex = 1;

        const allowedFields = [
            'title', 'customer_id', 'amount', 'expected_close_date',
            'source', 'notes', 'assigned_to'
        ];

        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                fields.push(`${field} = $${paramIndex++}`);
                values.push(req.body[field]);
            }
        });

        if (fields.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        const orgId = req.user?.organization_id;
        values.push(id);
        const idIndex = paramIndex;

        let query = `
            UPDATE deals
            SET ${fields.join(', ')}, updated_at = NOW()
            WHERE id = $${idIndex}
        `;

        if (orgId) {
            query += ` AND organization_id = $${idIndex + 1}`;
            values.push(orgId);
        }

        query += ' RETURNING *';

        const result = await pool.query(query, values);
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating deal:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Переместить сделку на другой этап
 */
router.put('/deals/:id/stage', authenticate, checkPermission('crm.manage'), async (req, res) => {
    try {
        const { id } = req.params;
        const { stage_id } = req.body;

        const orgId = req.user?.organization_id;
        let query = `
            UPDATE deals
            SET stage_id = $1, updated_at = NOW()
            WHERE id = $2
        `;
        const params = [stage_id, id];

        if (orgId) {
            query += ' AND organization_id = $3';
            params.push(orgId);
        }
        query += ' RETURNING *';

        const result = await pool.query(query, params);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error moving deal:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Получить активности сделки
 */
router.get('/deals/:id/activities', authenticate, checkPermission('crm.read'), async (req, res) => {
    try {
        const { id } = req.params;

        const orgId = req.user?.organization_id;
        let query = `
            SELECT da.*,
                u.full_name as assigned_name,
                creator.full_name as created_by_name
            FROM deal_activities da
            JOIN deals d ON da.deal_id = d.id
            LEFT JOIN users u ON da.assigned_to = u.id
            LEFT JOIN users creator ON da.created_by = creator.id
            WHERE da.deal_id = $1
        `;
        const params = [id];
        if (orgId) {
            query += ' AND d.organization_id = $2';
            params.push(orgId);
        }
        query += ' ORDER BY da.created_at DESC';

        const result = await pool.query(query, params);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching activities:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Добавить активность к сделке
 */
router.post('/deals/:id/activities', authenticate, checkPermission('crm.manage'), async (req, res) => {
    try {
        const { id } = req.params;
        const { activity_type, subject, description, scheduled_at, assigned_to } = req.body;

        const orgId = req.user?.organization_id;

        // Verify deal belongs to license
        if (orgId) {
            const dCheck = await pool.query('SELECT 1 FROM deals WHERE id = $1 AND organization_id = $2', [id, orgId]);
            if (dCheck.rows.length === 0) throw new Error('Сделка не найдена в вашей организации');
        }

        const result = await pool.query(`
            INSERT INTO deal_activities (
                deal_id, activity_type, subject, description,
                scheduled_at, assigned_to, created_by, organization_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [id, activity_type, subject, description, scheduled_at, assigned_to, req.user.userId, orgId]);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error creating activity:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Аналитика воронки
 */
router.get('/pipeline/analytics', authenticate, checkPermission('crm.read'), async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM pipeline_analytics');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching pipeline analytics:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// ПРОГРАММА ЛОЯЛЬНОСТИ
// ============================================================================

/**
 * Получить балансы клиентов
 */
router.get('/loyalty/customers', authenticate, checkPermission('crm.read'), async (req, res) => {
    try {
        const orgId = req.user?.organization_id;
        let query = `
            SELECT cl.*,
                c.name as customer_name,
                c.phone as customer_phone,
                lt.name as tier_name,
                lt.color as tier_color
            FROM customer_loyalty cl
            JOIN counterparties c ON cl.customer_id = c.id
            LEFT JOIN loyalty_tiers lt ON cl.tier_id = lt.id
        `;
        const params = [];
        if (orgId) {
            query += ' WHERE cl.organization_id = $1';
            params.push(orgId);
        }
        query += ' ORDER BY cl.total_points DESC';

        const result = await pool.query(query, params);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching loyalty customers:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Получить баллы конкретного клиента
 */
router.get('/loyalty/customers/:customerId', authenticate, checkPermission('crm.read'), async (req, res) => {
    try {
        const { customerId } = req.params;

        const loyalty = await pool.query(`
            SELECT cl.*,
                lt.name as tier_name,
                lt.discount_percent as tier_discount_percent,
                lt.points_multiplier
            FROM customer_loyalty cl
            LEFT JOIN loyalty_tiers lt ON cl.tier_id = lt.id
            WHERE cl.customer_id = $1
        `, [customerId]);

        if (loyalty.rows.length === 0) {
            return res.json({ total_points: 0, tier_name: 'Bronze', tier_discount: 0 });
        }

        res.json(loyalty.rows[0]);
    } catch (error) {
        console.error('Error fetching customer loyalty:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Начислить баллы (вызывается автоматически при продаже)
 */
router.post('/loyalty/earn', authenticate, async (req, res) => {
    try {
        const { customer_id, sale_id, amount } = req.body;

        const result = await pool.query(
            'SELECT earn_loyalty_points($1, $2, $3) as points',
            [customer_id, sale_id, amount]
        );

        res.json({ points: result.rows[0].points });
    } catch (error) {
        console.error('Error earning points:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Списать баллы
 */
router.post('/loyalty/spend', authenticate, async (req, res) => {
    try {
        const { customer_id, points, sale_id } = req.body;

        await pool.query(
            'SELECT spend_loyalty_points($1, $2, $3)',
            [customer_id, points, sale_id]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error spending points:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Получить историю транзакций баллов
 */
router.get('/loyalty/transactions/:customerId', authenticate, checkPermission('crm.read'), async (req, res) => {
    try {
        const { customerId } = req.params;

        const orgId = req.user?.organization_id;
        let query = `
            SELECT lt.*,
                s.document_number as sale_number
            FROM loyalty_transactions lt
            LEFT JOIN sales s ON lt.sale_id = s.id
            WHERE lt.customer_id = $1
        `;
        const params = [customerId];
        if (orgId) {
            query += ' AND lt.organization_id = $2';
            params.push(orgId);
        }
        query += ' ORDER BY lt.created_at DESC LIMIT 100';

        const result = await pool.query(query, params);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Получить уровни лояльности
 */
router.get('/loyalty/tiers', authenticate, checkPermission('crm.read'), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM loyalty_tiers
            ORDER BY position
        `);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching tiers:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Обновить уровень клиента
 */
router.post('/loyalty/update-tier/:customerId', authenticate, async (req, res) => {
    try {
        const { customerId } = req.params;

        await pool.query('SELECT update_customer_tier($1)', [customerId]);

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating tier:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// RFM АНАЛИЗ
// ============================================================================

/**
 * Получить RFM анализ всех клиентов
 */
router.get('/rfm/analysis', authenticate, checkPermission('crm.read'), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM customer_segments_view
            ORDER BY monetary DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching RFM analysis:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Получить список сегментов
 */
router.get('/rfm/segments', authenticate, checkPermission('crm.read'), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM customer_segments
            WHERE is_active = true
            ORDER BY code
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching segments:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Получить статистику по сегментам
 */
router.get('/rfm/segment-stats', authenticate, checkPermission('crm.read'), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                cs.code,
                cs.name,
                cs.color,
                COUNT(csv.id) as customer_count,
                COALESCE(SUM(csv.monetary), 0) as total_value,
                COALESCE(AVG(csv.monetary), 0) as avg_value
            FROM customer_segments cs
            LEFT JOIN customer_segments_view csv ON cs.code = csv.segment_code
            WHERE cs.is_active = true
            GROUP BY cs.code, cs.name, cs.color
            ORDER BY customer_count DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching segment stats:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// EMAIL-МАРКЕТИНГ
// ============================================================================

/**
 * Получить список кампаний
 */
router.get('/email/campaigns', authenticate, checkPermission('crm.read'), async (req, res) => {
    try {
        const orgId = req.user?.organization_id;
        let query = `
            SELECT ec.*,
                cs.name as segment_name,
                u.full_name as created_by_name
            FROM email_campaigns ec
            LEFT JOIN customer_segments cs ON ec.segment_code = cs.code
            LEFT JOIN users u ON ec.created_by = u.id
        `;
        const params = [];
        if (orgId) {
            query += ' WHERE ec.organization_id = $1';
            params.push(orgId);
        }
        query += ' ORDER BY ec.created_at DESC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching campaigns:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Создать кампанию
 */
router.post('/email/campaigns', authenticate, checkPermission('crm.manage'), auditLog('campaign'), async (req, res) => {
    try {
        const { name, subject, body, segment_code, scheduled_at } = req.body;

        const result = await pool.query(`
            INSERT INTO email_campaigns (
                name, subject, body, segment_code, scheduled_at, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [name, subject, body, segment_code, scheduled_at, req.user.userId]);

        // Создать список получателей
        await pool.query('SELECT create_campaign_recipients($1)', [result.rows[0].id]);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error creating campaign:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Получить получателей кампании
 */
router.get('/email/campaigns/:id/recipients', authenticate, checkPermission('crm.read'), async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            SELECT er.*,
                c.name as customer_name
            FROM email_recipients er
            LEFT JOIN counterparties c ON er.customer_id = c.id
            WHERE er.campaign_id = $1
            ORDER BY er.created_at DESC
        `, [id]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching recipients:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Получить шаблоны
 */
router.get('/email/templates', authenticate, checkPermission('crm.read'), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM email_templates
            WHERE is_active = true
            ORDER BY category, name
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching templates:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Отправить кампанию (заглушка - реальная отправка требует SMTP)
 */
router.post('/email/campaigns/:id/send', authenticate, checkPermission('crm.manage'), async (req, res) => {
    try {
        const { id } = req.params;

        // Обновить статус на "отправлено"
        await pool.query(`
            UPDATE email_campaigns
            SET status = 'sent', sent_at = NOW()
            WHERE id = $1
        `, [id]);

        // В реальной системе здесь была бы интеграция с SMTP/SendGrid/Mailgun
        // Для демонстрации просто помечаем всех получателей как отправленные
        await pool.query(`
            UPDATE email_recipients
            SET status = 'sent', sent_at = NOW()
            WHERE campaign_id = $1 AND status = 'pending'
        `, [id]);

        res.json({ success: true, message: 'Кампания отправлена (демо режим)' });
    } catch (error) {
        console.error('Error sending campaign:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
