import express from 'express';
import pool from '../config/database.js';
import { authenticate, authorize, logAudit } from '../middleware/auth.js';


const router = express.Router();

// Авто-создание таблицы при первом запросе
async function ensurePayrollTable() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS payroll_records (
            id SERIAL PRIMARY KEY,
            employee_id INTEGER NOT NULL REFERENCES users(id),
            period_year INTEGER NOT NULL,
            period_month INTEGER NOT NULL,
            base_salary DECIMAL(12,2) DEFAULT 0,
            bonuses DECIMAL(12,2) DEFAULT 0,
            deductions DECIMAL(12,2) DEFAULT 0,
            net_amount DECIMAL(12,2) GENERATED ALWAYS AS (base_salary + bonuses - deductions) STORED,
            status VARCHAR(20) DEFAULT 'draft',
            notes TEXT,
            paid_at TIMESTAMP,
            paid_by INTEGER,
            license_id INTEGER,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(employee_id, period_year, period_month)
        )
    `);
}

// GET /api/payroll — список начислений
router.get('/', authenticate, async (req, res) => {
    try {
        await ensurePayrollTable();
        const { year, month, status } = req.query;
        const userLicenseId = req.user?.license_id;

        let query = `
            SELECT pr.*, 
                   u.full_name as employee_name, 
                   u.username as employee_username,
                   u.position as employee_position
            FROM payroll_records pr
            LEFT JOIN users u ON pr.employee_id = u.id
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 1;

        if (userLicenseId) {
            query += ` AND (pr.license_id = $${paramCount} OR pr.license_id IS NULL)`;
            params.push(userLicenseId);
            paramCount++;
        }
        if (year) {
            query += ` AND pr.period_year = $${paramCount}`;
            params.push(parseInt(year));
            paramCount++;
        }
        if (month) {
            query += ` AND pr.period_month = $${paramCount}`;
            params.push(parseInt(month));
            paramCount++;
        }
        if (status) {
            query += ` AND pr.status = $${paramCount}`;
            params.push(status);
            paramCount++;
        }

        query += ' ORDER BY pr.period_year DESC, pr.period_month DESC, u.full_name';

        const result = await pool.query(query, params);

        // Сводная статистика
        const totalResult = await pool.query(`
            SELECT 
                COUNT(*) as total_records,
                SUM(base_salary) as total_base,
                SUM(bonuses) as total_bonuses,
                SUM(deductions) as total_deductions,
                SUM(net_amount) as total_net
            FROM payroll_records pr
            WHERE ($1::int IS NULL OR pr.license_id = $1)
              AND ($2::int IS NULL OR pr.period_year = $2)
              AND ($3::int IS NULL OR pr.period_month = $3)
        `, [userLicenseId || null, year ? parseInt(year) : null, month ? parseInt(month) : null]);

        res.json({
            payroll: result.rows,
            stats: totalResult.rows[0]
        });
    } catch (error) {
        console.error('Ошибка получения зарплат:', error);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
});

// GET /api/payroll/:id — конкретное начисление
router.get('/:id', authenticate, async (req, res) => {
    try {
        await ensurePayrollTable();
        const { id } = req.params;
        const userLicenseId = req.user?.license_id;

        let query = `
            SELECT pr.*, u.full_name as employee_name, u.username as employee_username
            FROM payroll_records pr
            LEFT JOIN users u ON pr.employee_id = u.id
            WHERE pr.id = $1
        `;
        const params = [id];

        if (userLicenseId) {
            query += ' AND (pr.license_id = $2 OR pr.license_id IS NULL)';
            params.push(userLicenseId);
        }

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Запись не найдена' });
        }

        res.json({ record: result.rows[0] });
    } catch (error) {
        console.error('Ошибка получения начисления:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// POST /api/payroll — создать начисление
router.post('/', authenticate, authorize('Администратор', 'Бухгалтер'), async (req, res) => {
    try {
        await ensurePayrollTable();
        const {
            employeeId, periodYear, periodMonth,
            baseSalary, bonuses, deductions, notes
        } = req.body;

        if (!employeeId || !periodYear || !periodMonth) {
            return res.status(400).json({ error: 'Обязательные поля: employeeId, periodYear, periodMonth' });
        }

        const userLicenseId = req.user?.license_id;

        const result = await pool.query(`
            INSERT INTO payroll_records 
                (employee_id, period_year, period_month, base_salary, bonuses, deductions, notes, license_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (employee_id, period_year, period_month)
            DO UPDATE SET
                base_salary = $4, bonuses = $5, deductions = $6, notes = $7,
                updated_at = NOW()
            RETURNING *
        `, [
            employeeId, periodYear, periodMonth,
            baseSalary || 0, bonuses || 0, deductions || 0,
            notes || null, userLicenseId
        ]);

        await logAudit(req.user.id, 'CREATE', 'payroll_records', result.rows[0].id, null, result.rows[0], req.ip);

        res.status(201).json({
            message: 'Начисление создано',
            record: result.rows[0]
        });
    } catch (error) {
        console.error('Ошибка создания начисления:', error);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
});

// PUT /api/payroll/:id — обновить начисление
router.put('/:id', authenticate, authorize('Администратор', 'Бухгалтер'), async (req, res) => {
    try {
        await ensurePayrollTable();
        const { id } = req.params;
        const { baseSalary, bonuses, deductions, notes, status } = req.body;
        const userLicenseId = req.user?.license_id;

        // Нельзя изменить оплаченное
        const check = await pool.query('SELECT status FROM payroll_records WHERE id = $1', [id]);
        if (check.rows.length === 0) return res.status(404).json({ error: 'Запись не найдена' });
        if (check.rows[0].status === 'paid') return res.status(400).json({ error: 'Нельзя изменить оплаченное начисление' });

        let updateQuery = `
            UPDATE payroll_records 
            SET base_salary = COALESCE($1, base_salary),
                bonuses = COALESCE($2, bonuses),
                deductions = COALESCE($3, deductions),
                notes = COALESCE($4, notes),
                updated_at = NOW()
            WHERE id = $5
        `;
        const params = [baseSalary, bonuses, deductions, notes, id];

        if (userLicenseId) {
            updateQuery += ' AND (license_id = $6 OR license_id IS NULL)';
            params.push(userLicenseId);
        }
        updateQuery += ' RETURNING *';

        const result = await pool.query(updateQuery, params);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Запись не найдена' });

        res.json({ message: 'Начисление обновлено', record: result.rows[0] });
    } catch (error) {
        console.error('Ошибка обновления начисления:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// POST /api/payroll/:id/pay — выплатить зарплату
router.post('/:id/pay', authenticate, authorize('Администратор', 'Бухгалтер'), async (req, res) => {
    try {
        await ensurePayrollTable();
        const { id } = req.params;
        const userLicenseId = req.user?.license_id;

        let query = `
            UPDATE payroll_records 
            SET status = 'paid', paid_at = NOW(), paid_by = $1, updated_at = NOW()
            WHERE id = $2 AND status != 'paid'
        `;
        const params = [req.user.id, id];

        if (userLicenseId) {
            query += ' AND (license_id = $3 OR license_id IS NULL)';
            params.push(userLicenseId);
        }
        query += ' RETURNING *';

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Запись не найдена или уже выплачена' });
        }

        await logAudit(req.user.id, 'PAY', 'payroll_records', id, null, result.rows[0], req.ip);

        res.json({ message: 'Зарплата выплачена', record: result.rows[0] });
    } catch (error) {
        console.error('Ошибка выплаты зарплаты:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// POST /api/payroll/mass-calculate — массовый расчёт для всех сотрудников
router.post('/mass-calculate', authenticate, authorize('Администратор', 'Бухгалтер'), async (req, res) => {
    try {
        await ensurePayrollTable();
        const { year, month, baseSalary = 0 } = req.body;

        if (!year || !month) {
            return res.status(400).json({ error: 'Обязательные поля: year, month' });
        }

        const userLicenseId = req.user?.license_id;

        // Получить всех активных сотрудников
        let empQuery = 'SELECT id FROM users WHERE is_active = true AND role != $1';
        const empParams = ['Суперадмин'];

        if (userLicenseId) {
            empQuery += ' AND (license_id = $2 OR license_id IS NULL)';
            empParams.push(userLicenseId);
        }

        const employees = await pool.query(empQuery, empParams);

        let created = 0;
        for (const emp of employees.rows) {
            await pool.query(`
                INSERT INTO payroll_records (employee_id, period_year, period_month, base_salary, license_id)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (employee_id, period_year, period_month) DO NOTHING
            `, [emp.id, year, month, baseSalary, userLicenseId]);
            created++;
        }

        res.json({
            message: `Расчёт зарплат выполнен для ${created} сотрудников`,
            period: `${month}/${year}`,
            employees_count: created
        });
    } catch (error) {
        console.error('Ошибка массового расчёта:', error);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
});

// DELETE /api/payroll/:id — удалить черновик
router.delete('/:id', authenticate, authorize('Администратор'), async (req, res) => {
    try {
        await ensurePayrollTable();
        const { id } = req.params;
        const userLicenseId = req.user?.license_id;

        let query = 'DELETE FROM payroll_records WHERE id = $1 AND status = $2';
        const params = [id, 'draft'];

        if (userLicenseId) {
            query += ' AND (license_id = $3 OR license_id IS NULL)';
            params.push(userLicenseId);
        }
        query += ' RETURNING id';

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Запись не найдена или её нельзя удалить (только черновики)' });
        }

        res.json({ message: 'Начисление удалено' });
    } catch (error) {
        console.error('Ошибка удаления:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

export default router;
