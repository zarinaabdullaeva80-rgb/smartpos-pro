/**
 * Database initialization module
 * Creates all required tables if they don't exist
 * Safe to run on every startup (uses CREATE TABLE IF NOT EXISTS)
 */
import bcrypt from 'bcrypt';

export async function initDatabase(pool) {
    console.log('🔧 Инициализация базы данных...');

    try {
        // Check if users table exists
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables WHERE table_name = 'users'
            )
        `);

        if (tableCheck.rows[0].exists) {
            console.log('✅ Таблица users существует, проверяем остальные таблицы...');
            // Always run CREATE TABLE IF NOT EXISTS + ALTER TABLE for missing columns
            await addMissingColumns(pool);
            // Don't return — continue to create any missing tables
        }

        console.log('📦 Создание таблиц базы данных...');

        // ============================================
        // ПОЛЬЗОВАТЕЛИ И ПРАВА
        // ============================================

        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(100) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                full_name VARCHAR(255),
                phone VARCHAR(50),
                role VARCHAR(50) DEFAULT 'cashier',
                is_active BOOLEAN DEFAULT true,
                last_login TIMESTAMP,
                two_factor_enabled BOOLEAN DEFAULT false,
                two_factor_secret VARCHAR(255),
                license_id INTEGER,
                user_level VARCHAR(50) DEFAULT 'employee',
                user_type VARCHAR(50) DEFAULT 'employee',
                created_by_license_id INTEGER,
                role_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✓ users');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS permissions (
                id SERIAL PRIMARY KEY,
                code VARCHAR(100) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                category VARCHAR(50),
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✓ permissions');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS role_permissions (
                id SERIAL PRIMARY KEY,
                role VARCHAR(50) NOT NULL,
                permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(role, permission_id)
            )
        `);
        console.log('  ✓ role_permissions');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS audit_log (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                action VARCHAR(50) NOT NULL,
                table_name VARCHAR(100),
                record_id INTEGER,
                old_values JSONB,
                new_values JSONB,
                ip_address VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✓ audit_log');

        // ============================================
        // ТОВАРЫ И КАТЕГОРИИ
        // ============================================

        await pool.query(`
            CREATE TABLE IF NOT EXISTS product_categories (
                id SERIAL PRIMARY KEY,
                code VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                parent_id INTEGER REFERENCES product_categories(id),
                is_active BOOLEAN DEFAULT true,
                sort_order INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✓ product_categories');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                code VARCHAR(50) UNIQUE NOT NULL,
                barcode VARCHAR(100),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                category_id INTEGER REFERENCES product_categories(id),
                unit VARCHAR(50) DEFAULT 'шт',
                price DECIMAL(15, 2) NOT NULL DEFAULT 0,
                price_purchase DECIMAL(15, 2) DEFAULT 0,
                price_sale DECIMAL(15, 2) DEFAULT 0,
                price_retail DECIMAL(15, 2) DEFAULT 0,
                purchase_price DECIMAL(15, 2),
                vat_rate DECIMAL(5, 2) DEFAULT 20,
                min_stock DECIMAL(10, 2) DEFAULT 0,
                max_stock DECIMAL(10, 2),
                is_active BOOLEAN DEFAULT true,
                image_url VARCHAR(500),
                license_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✓ products');

        // ============================================
        // СКЛАДЫ
        // ============================================

        await pool.query(`
            CREATE TABLE IF NOT EXISTS warehouses (
                id SERIAL PRIMARY KEY,
                code VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                address TEXT,
                responsible_person VARCHAR(255),
                latitude DECIMAL(10, 8),
                longitude DECIMAL(11, 8),
                phone VARCHAR(50),
                email VARCHAR(255),
                working_hours VARCHAR(255),
                capacity DECIMAL(15, 2),
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✓ warehouses');

        // ============================================
        // СКЛАДСКИЕ ДВИЖЕНИЯ (КРИТИЧЕСКАЯ ТАБЛИЦА)
        // ============================================

        await pool.query(`
            CREATE TABLE IF NOT EXISTS inventory_movements (
                id SERIAL PRIMARY KEY,
                product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
                warehouse_id INTEGER REFERENCES warehouses(id),
                document_type VARCHAR(50) DEFAULT 'adjustment',
                document_id INTEGER,
                quantity DECIMAL(15, 3) NOT NULL DEFAULT 0,
                cost_price DECIMAL(15, 2),
                user_id INTEGER REFERENCES users(id),
                license_id INTEGER,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✓ inventory_movements');

        // ============================================
        // КОНТРАГЕНТЫ
        // ============================================

        await pool.query(`
            CREATE TABLE IF NOT EXISTS counterparties (
                id SERIAL PRIMARY KEY,
                code VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                type VARCHAR(50),
                inn VARCHAR(20),
                phone VARCHAR(50),
                email VARCHAR(255),
                address TEXT,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✓ counterparties');

        // ============================================
        // СМЕНЫ И ПРОДАЖИ
        // ============================================

        await pool.query(`
            CREATE TABLE IF NOT EXISTS shifts (
                id SERIAL PRIMARY KEY,
                shift_number VARCHAR(50) UNIQUE NOT NULL,
                user_id INTEGER REFERENCES users(id),
                started_at TIMESTAMP,
                ended_at TIMESTAMP,
                initial_cash DECIMAL(15, 2) DEFAULT 0,
                final_cash DECIMAL(15, 2) DEFAULT 0,
                sales_count INTEGER DEFAULT 0,
                total_amount DECIMAL(15, 2) DEFAULT 0,
                status VARCHAR(50) DEFAULT 'open',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✓ shifts');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS sales (
                id SERIAL PRIMARY KEY,
                document_number VARCHAR(100) UNIQUE NOT NULL,
                document_date DATE NOT NULL DEFAULT CURRENT_DATE,
                customer_id INTEGER REFERENCES counterparties(id),
                total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
                vat_amount DECIMAL(15, 2) DEFAULT 0,
                discount_amount DECIMAL(15, 2) DEFAULT 0,
                discount_percent DECIMAL(5, 2) DEFAULT 0,
                final_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
                payment_type VARCHAR(50),
                warehouse_id INTEGER REFERENCES warehouses(id),
                status VARCHAR(50) DEFAULT 'confirmed',
                user_id INTEGER REFERENCES users(id),
                shift_id INTEGER REFERENCES shifts(id),
                license_id INTEGER,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✓ sales');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS sale_items (
                id SERIAL PRIMARY KEY,
                sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
                product_id INTEGER REFERENCES products(id),
                quantity DECIMAL(10, 3) NOT NULL,
                price DECIMAL(15, 2) NOT NULL,
                discount_amount DECIMAL(15, 2) DEFAULT 0,
                total_price DECIMAL(15, 2) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✓ sale_items');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS sale_payment_details (
                id SERIAL PRIMARY KEY,
                sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
                payment_method_code VARCHAR(50) NOT NULL,
                amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✓ sale_payment_details');

        // ============================================
        // КЛИЕНТЫ И TELEGRAM
        // ============================================

        await pool.query(`
            CREATE TABLE IF NOT EXISTS customers (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                phone VARCHAR(50),
                email VARCHAR(255),
                card_number VARCHAR(20) UNIQUE,
                loyalty_points DECIMAL(10, 2) DEFAULT 0,
                total_purchases DECIMAL(15, 2) DEFAULT 0,
                visit_count INTEGER DEFAULT 0,
                last_visit TIMESTAMP,
                birthday DATE,
                notes TEXT,
                is_active BOOLEAN DEFAULT true,
                license_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✓ customers');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS telegram_bots (
                id SERIAL PRIMARY KEY,
                license_id INTEGER,
                bot_token VARCHAR(255),
                bot_username VARCHAR(100),
                bot_first_name VARCHAR(100),
                webhook_url VARCHAR(500),
                webhook_secret VARCHAR(255),
                is_active BOOLEAN DEFAULT true,
                is_verified BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✓ telegram_bots');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS telegram_chats (
                id SERIAL PRIMARY KEY,
                chat_id BIGINT NOT NULL,
                username VARCHAR(100),
                first_name VARCHAR(100),
                license_id INTEGER,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✓ telegram_chats');

        // ============================================
        // ВОЗВРАТЫ
        // ============================================

        await pool.query(`
            CREATE TABLE IF NOT EXISTS returns (
                id SERIAL PRIMARY KEY,
                document_number VARCHAR(100) UNIQUE NOT NULL,
                document_date DATE NOT NULL DEFAULT CURRENT_DATE,
                sale_id INTEGER REFERENCES sales(id),
                total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
                reason TEXT,
                status VARCHAR(50) DEFAULT 'confirmed',
                user_id INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✓ returns');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS return_items (
                id SERIAL PRIMARY KEY,
                return_id INTEGER REFERENCES returns(id) ON DELETE CASCADE,
                sale_item_id INTEGER REFERENCES sale_items(id),
                product_id INTEGER REFERENCES products(id),
                quantity DECIMAL(10, 3) NOT NULL,
                price DECIMAL(15, 2) NOT NULL,
                total_price DECIMAL(15, 2) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✓ return_items');

        // ============================================
        // ЗАКУПКИ
        // ============================================

        await pool.query(`
            CREATE TABLE IF NOT EXISTS purchases (
                id SERIAL PRIMARY KEY,
                document_number VARCHAR(100) UNIQUE NOT NULL,
                document_date DATE NOT NULL DEFAULT CURRENT_DATE,
                supplier_id INTEGER REFERENCES counterparties(id),
                warehouse_id INTEGER REFERENCES warehouses(id),
                total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
                final_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
                status VARCHAR(50) DEFAULT 'confirmed',
                user_id INTEGER REFERENCES users(id),
                license_id INTEGER,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✓ purchases');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS purchase_items (
                id SERIAL PRIMARY KEY,
                purchase_id INTEGER REFERENCES purchases(id) ON DELETE CASCADE,
                product_id INTEGER REFERENCES products(id),
                quantity DECIMAL(10, 3) NOT NULL,
                price DECIMAL(15, 2) NOT NULL,
                total_price DECIMAL(15, 2) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✓ purchase_items');

        // ============================================
        // ФИНАНСЫ
        // ============================================

        await pool.query(`
            CREATE TABLE IF NOT EXISTS bank_accounts (
                id SERIAL PRIMARY KEY,
                code VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                type VARCHAR(50),
                account_number VARCHAR(100),
                bank_name VARCHAR(255),
                currency VARCHAR(10) DEFAULT 'UZS',
                balance DECIMAL(15, 2) DEFAULT 0,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✓ bank_accounts');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS payments (
                id SERIAL PRIMARY KEY,
                document_number VARCHAR(100) UNIQUE NOT NULL,
                document_date DATE NOT NULL DEFAULT CURRENT_DATE,
                payment_type VARCHAR(50),
                counterparty_id INTEGER REFERENCES counterparties(id),
                bank_account_id INTEGER REFERENCES bank_accounts(id),
                amount DECIMAL(15, 2) NOT NULL,
                currency VARCHAR(10) DEFAULT 'UZS',
                purpose TEXT,
                related_document_type VARCHAR(50),
                related_document_id INTEGER,
                status VARCHAR(50) DEFAULT 'confirmed',
                user_id INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✓ payments');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
                debit_account VARCHAR(20) NOT NULL,
                credit_account VARCHAR(20) NOT NULL,
                amount DECIMAL(15, 2) NOT NULL,
                description TEXT,
                document_type VARCHAR(50),
                document_id INTEGER,
                user_id INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✓ transactions');

        // ============================================
        // ЛИЦЕНЗИРОВАНИЕ
        // ============================================

        await pool.query(`
            CREATE TABLE IF NOT EXISTS licenses (
                id SERIAL PRIMARY KEY,
                license_key VARCHAR(255) UNIQUE NOT NULL,
                product_name VARCHAR(255),
                company_name VARCHAR(255),
                customer_name VARCHAR(255),
                customer_email VARCHAR(255),
                customer_username VARCHAR(100),
                customer_password_hash VARCHAR(255),
                customer_phone VARCHAR(50),
                license_type VARCHAR(50) DEFAULT 'monthly',
                max_devices INTEGER DEFAULT 1,
                max_users INTEGER DEFAULT 5,
                max_pos_terminals INTEGER DEFAULT 1,
                status VARCHAR(20) DEFAULT 'active',
                features JSONB DEFAULT '{}',
                server_type VARCHAR(50),
                server_url VARCHAR(500),
                expires_at TIMESTAMP,
                trial_days INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT true,
                metadata JSONB,
                created_by INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✓ licenses');

        // ============================================
        // RBAC (Роли)
        // ============================================

        await pool.query(`
            CREATE TABLE IF NOT EXISTS roles (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) UNIQUE NOT NULL,
                code VARCHAR(50) UNIQUE,
                description TEXT,
                is_system BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✓ roles');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_roles (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, role_id)
            )
        `);
        console.log('  ✓ user_roles');

        // ============================================
        // СИСТЕМНЫЕ НАСТРОЙКИ
        // ============================================

        await pool.query(`
            CREATE TABLE IF NOT EXISTS system_settings (
                id SERIAL PRIMARY KEY,
                setting_key VARCHAR(100) UNIQUE NOT NULL,
                setting_value JSONB,
                description TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✓ system_settings');

        // ============================================
        // СОТРУДНИКИ
        // ============================================

        await pool.query(`
            CREATE TABLE IF NOT EXISTS employees (
                id SERIAL PRIMARY KEY,
                code VARCHAR(50) UNIQUE NOT NULL,
                full_name VARCHAR(255) NOT NULL,
                position VARCHAR(100),
                department VARCHAR(100),
                phone VARCHAR(50),
                email VARCHAR(255),
                hire_date DATE,
                salary DECIMAL(15, 2),
                is_active BOOLEAN DEFAULT true,
                user_id INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✓ employees');

        // ============================================
        // СЧЕТА-ФАКТУРЫ
        // ============================================

        await pool.query(`
            CREATE TABLE IF NOT EXISTS invoices (
                id SERIAL PRIMARY KEY,
                invoice_number VARCHAR(100) UNIQUE NOT NULL,
                invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
                counterparty_id INTEGER REFERENCES counterparties(id),
                total_amount DECIMAL(15, 2) NOT NULL,
                vat_amount DECIMAL(15, 2) DEFAULT 0,
                status VARCHAR(50) DEFAULT 'draft',
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✓ invoices');

        // ============================================
        // СИНХРОНИЗАЦИЯ
        // ============================================

        await pool.query(`
            CREATE TABLE IF NOT EXISTS sync_sessions (
                id SERIAL PRIMARY KEY,
                session_id VARCHAR(100) UNIQUE NOT NULL,
                direction VARCHAR(50),
                status VARCHAR(50),
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                finished_at TIMESTAMP,
                records_total INTEGER DEFAULT 0,
                records_success INTEGER DEFAULT 0,
                records_failed INTEGER DEFAULT 0,
                error_message TEXT
            )
        `);
        console.log('  ✓ sync_sessions');

        // ============================================
        // АКТИВАЦИИ УСТРОЙСТВ
        // ============================================

        await pool.query(`
            CREATE TABLE IF NOT EXISTS license_activations (
                id SERIAL PRIMARY KEY,
                license_id INTEGER REFERENCES licenses(id) ON DELETE CASCADE,
                device_id VARCHAR(255) NOT NULL,
                device_type VARCHAR(50) NOT NULL,
                device_name VARCHAR(255),
                device_fingerprint TEXT,
                activated_at TIMESTAMP DEFAULT NOW(),
                last_seen TIMESTAMP DEFAULT NOW(),
                last_ip VARCHAR(50),
                is_active BOOLEAN DEFAULT true,
                deactivated_at TIMESTAMP,
                deactivation_reason TEXT,
                UNIQUE(license_id, device_id)
            )
        `);
        console.log('  ✓ license_activations');

        // ============================================
        // КОНФИГУРАЦИИ
        // ============================================

        await pool.query(`
            CREATE TABLE IF NOT EXISTS configurations (
                id SERIAL PRIMARY KEY,
                key VARCHAR(255) UNIQUE NOT NULL,
                value JSONB,
                category VARCHAR(100),
                description TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✓ configurations');

        // ============================================
        // ИНДЕКСЫ
        // ============================================

        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)',
            'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
            'CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)',
            'CREATE INDEX IF NOT EXISTS idx_users_license ON users(license_id)',
            'CREATE INDEX IF NOT EXISTS idx_products_code ON products(code)',
            'CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)',
            'CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)',
            'CREATE INDEX IF NOT EXISTS idx_products_license ON products(license_id)',
            'CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active)',
            'CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(document_date)',
            'CREATE INDEX IF NOT EXISTS idx_sales_user ON sales(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_sales_shift ON sales(shift_id)',
            'CREATE INDEX IF NOT EXISTS idx_sales_license ON sales(license_id)',
            'CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status)',
            'CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id)',
            'CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id)',
            'CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id)',
            'CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(document_date)',
            'CREATE INDEX IF NOT EXISTS idx_purchases_license ON purchases(license_id)',
            'CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date)',
            'CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_audit_log_table ON audit_log(table_name)',
            'CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at)',
            'CREATE INDEX IF NOT EXISTS idx_licenses_key ON licenses(license_key)',
            'CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status)',
            'CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id)',
            'CREATE INDEX IF NOT EXISTS idx_inventory_movements_warehouse ON inventory_movements(warehouse_id)',
            'CREATE INDEX IF NOT EXISTS idx_inventory_movements_license ON inventory_movements(license_id)',
            'CREATE INDEX IF NOT EXISTS idx_counterparties_license ON counterparties(license_id)',
            'CREATE INDEX IF NOT EXISTS idx_warehouses_license ON warehouses(license_id)',
        ];

        for (const idx of indexes) {
            try { await pool.query(idx); } catch (e) { /* ignore */ }
        }
        console.log('  ✓ indexes');

        // ============================================
        // БАЗОВЫЕ ДАННЫЕ: РОЛИ
        // ============================================

        await pool.query(`
            INSERT INTO roles (name, code, is_system) VALUES
            ('Администратор', 'admin', true),
            ('Менеджер', 'manager', true),
            ('Кассир', 'cashier', true),
            ('Бухгалтер', 'accountant', true)
            ON CONFLICT (code) DO NOTHING
        `);
        console.log('  ✓ default roles');

        // ============================================
        // БАЗОВЫЕ ДАННЫЕ: СКЛАД ПО УМОЛЧАНИЮ
        // ============================================

        await pool.query(`
            INSERT INTO warehouses (code, name, address, is_active) VALUES
            ('WH-001', 'Основной склад', 'г. Ташкент', true)
            ON CONFLICT (code) DO NOTHING
        `);
        console.log('  ✓ default warehouse');

        // ============================================
        // БАЗОВЫЕ ДАННЫЕ: КАТЕГОРИЯ
        // ============================================

        await pool.query(`
            INSERT INTO product_categories (code, name) VALUES
            ('CAT-001', 'Общие товары')
            ON CONFLICT (code) DO NOTHING
        `);
        console.log('  ✓ default category');

        // ============================================
        // БАЗОВЫЕ ДАННЫЕ: КАССА
        // ============================================

        await pool.query(`
            INSERT INTO bank_accounts (code, name, type, balance) VALUES
            ('CASH-001', 'Касса', 'cash', 0)
            ON CONFLICT (code) DO NOTHING
        `);
        console.log('  ✓ default cash register');

        // ============================================
        // БАЗОВЫЕ ДАННЫЕ: АДМИНИСТРАТОР ПО УМОЛЧАНИЮ
        // ============================================

        const existingUsers = await pool.query('SELECT COUNT(*) as cnt FROM users');
        if (parseInt(existingUsers.rows[0].cnt) === 0) {
            const adminPasswordHash = await bcrypt.hash('admin', 10);
            const adminResult = await pool.query(`
                INSERT INTO users (username, email, password_hash, full_name, role, is_active, user_level, user_type)
                VALUES ('admin', 'admin@smartpos.local', $1, 'Администратор', 'Администратор', true, 'admin', 'super_admin')
                ON CONFLICT (username) DO NOTHING
                RETURNING id
            `, [adminPasswordHash]);

            if (adminResult.rows.length > 0) {
                // Assign admin role
                try {
                    const adminRoleResult = await pool.query('SELECT id FROM roles WHERE code = $1', ['admin']);
                    if (adminRoleResult.rows.length > 0) {
                        await pool.query(
                            'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                            [adminResult.rows[0].id, adminRoleResult.rows[0].id]
                        );
                    }
                } catch (e) { /* ignore */ }
                console.log('  ✓ default admin user (admin/admin) [super_admin]');
            }
        }

        // Fix: ensure existing admin user has super_admin type
        try {
            await pool.query(`
                UPDATE users SET user_type = 'super_admin', user_level = 'admin'
                WHERE username = 'admin' AND (user_type IS NULL OR user_type != 'super_admin')
            `);
        } catch (e) { /* ignore */ }

        // Add FK constraints now that licenses table exists
        try {
            await pool.query(`
                ALTER TABLE users 
                ADD CONSTRAINT fk_users_license_id 
                FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE SET NULL
            `);
        } catch (e) { /* constraint may already exist */ }

        try {
            await pool.query(`
                ALTER TABLE users 
                ADD CONSTRAINT fk_users_created_by_license_id 
                FOREIGN KEY (created_by_license_id) REFERENCES licenses(id) ON DELETE SET NULL
            `);
        } catch (e) { /* constraint may already exist */ }


        console.log('✅ База данных инициализирована успешно!');

    } catch (error) {
        console.error('❌ Ошибка инициализации базы данных:', error.message);
        throw error;
    }
}

async function addMissingColumns(pool) {
    const alterQueries = [
        'ALTER TABLE users ADD COLUMN IF NOT EXISTS license_id INTEGER',
        'ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by_license_id INTEGER',
        'ALTER TABLE users ADD COLUMN IF NOT EXISTS user_level VARCHAR(50) DEFAULT \'employee\'',
        'ALTER TABLE users ADD COLUMN IF NOT EXISTS user_type VARCHAR(50) DEFAULT \'employee\'',
        'ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INTEGER',
        // Loyalty card support
        'ALTER TABLE customers ADD COLUMN IF NOT EXISTS card_number VARCHAR(20) UNIQUE',
        // Counterparties missing columns
        'ALTER TABLE counterparties ADD COLUMN IF NOT EXISTS inn VARCHAR(12)',
        'ALTER TABLE counterparties ADD COLUMN IF NOT EXISTS kpp VARCHAR(9)',
        'ALTER TABLE counterparties ADD COLUMN IF NOT EXISTS address TEXT',
        'ALTER TABLE counterparties ADD COLUMN IF NOT EXISTS phone VARCHAR(50)',
        'ALTER TABLE counterparties ADD COLUMN IF NOT EXISTS email VARCHAR(255)',
        'ALTER TABLE counterparties ADD COLUMN IF NOT EXISTS contact_person VARCHAR(255)',
        'ALTER TABLE counterparties ADD COLUMN IF NOT EXISTS payment_terms INTEGER DEFAULT 0',
        'ALTER TABLE counterparties ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(15,2) DEFAULT 0',
        // Loyalty settings missing columns
        'ALTER TABLE loyalty_settings ADD COLUMN IF NOT EXISTS cashback_percent NUMERIC(5,2) DEFAULT 2',
        'ALTER TABLE loyalty_settings ADD COLUMN IF NOT EXISTS min_purchase NUMERIC(15,2) DEFAULT 10000',
        'ALTER TABLE loyalty_settings ADD COLUMN IF NOT EXISTS points_expiry_days INTEGER DEFAULT 365',
        'ALTER TABLE loyalty_settings ADD COLUMN IF NOT EXISTS welcome_bonus INTEGER DEFAULT 1000',
        'ALTER TABLE loyalty_settings ADD COLUMN IF NOT EXISTS birthday_bonus INTEGER DEFAULT 5000',
        'ALTER TABLE loyalty_settings ADD COLUMN IF NOT EXISTS referral_bonus INTEGER DEFAULT 2000',
        'ALTER TABLE loyalty_settings ADD COLUMN IF NOT EXISTS max_discount_percent INTEGER DEFAULT 30',
        'ALTER TABLE loyalty_settings ADD COLUMN IF NOT EXISTS points_to_currency NUMERIC(5,2) DEFAULT 1',
        'ALTER TABLE loyalty_settings ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT TRUE',

        // ============================================
        // MULTI-TENANT: organization_id columns
        // ============================================
        'ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id INTEGER',
        'ALTER TABLE products ADD COLUMN IF NOT EXISTS organization_id INTEGER DEFAULT 1',
        'ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS organization_id INTEGER DEFAULT 1',
        'ALTER TABLE sales ADD COLUMN IF NOT EXISTS organization_id INTEGER DEFAULT 1',
        'ALTER TABLE customers ADD COLUMN IF NOT EXISTS organization_id INTEGER DEFAULT 1',
        'ALTER TABLE employees ADD COLUMN IF NOT EXISTS organization_id INTEGER DEFAULT 1',
        'ALTER TABLE counterparties ADD COLUMN IF NOT EXISTS organization_id INTEGER DEFAULT 1',
        'ALTER TABLE purchases ADD COLUMN IF NOT EXISTS organization_id INTEGER DEFAULT 1',
        'ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS organization_id INTEGER DEFAULT 1',
        'ALTER TABLE payments ADD COLUMN IF NOT EXISTS organization_id INTEGER DEFAULT 1',
        'ALTER TABLE transactions ADD COLUMN IF NOT EXISTS organization_id INTEGER DEFAULT 1',
        'ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS organization_id INTEGER DEFAULT 1',
        'ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS organization_id INTEGER DEFAULT 1',
        'ALTER TABLE invoices ADD COLUMN IF NOT EXISTS organization_id INTEGER DEFAULT 1',
        'ALTER TABLE returns ADD COLUMN IF NOT EXISTS organization_id INTEGER DEFAULT 1',
        'ALTER TABLE shifts ADD COLUMN IF NOT EXISTS organization_id INTEGER DEFAULT 1',
        'ALTER TABLE configurations ADD COLUMN IF NOT EXISTS organization_id INTEGER DEFAULT 1',
        // Indexes for organization_id
        'CREATE INDEX IF NOT EXISTS idx_products_org ON products(organization_id)',
        'CREATE INDEX IF NOT EXISTS idx_sales_org ON sales(organization_id)',
        'CREATE INDEX IF NOT EXISTS idx_customers_org ON customers(organization_id)',
        'CREATE INDEX IF NOT EXISTS idx_employees_org ON employees(organization_id)',
        'CREATE INDEX IF NOT EXISTS idx_categories_org ON product_categories(organization_id)',
        // Allow NULL in products.code (ИКПУ may be empty in import files)
        'ALTER TABLE products ALTER COLUMN code DROP NOT NULL',
        // ============================================
        // PRODUCTS: missing columns used in GET /api/products
        // ============================================
        'ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier VARCHAR(255)',
        'ALTER TABLE products ADD COLUMN IF NOT EXISTS price_retail DECIMAL(15,2) DEFAULT 0',
        'ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock DECIMAL(10,2) DEFAULT 0',
        'ALTER TABLE products ADD COLUMN IF NOT EXISTS max_stock DECIMAL(10,2)',
        'ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode VARCHAR(100)',
        'ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url VARCHAR(500)',
        'ALTER TABLE products ADD COLUMN IF NOT EXISTS vat_rate DECIMAL(5,2) DEFAULT 20',
        'ALTER TABLE products ADD COLUMN IF NOT EXISTS price DECIMAL(15,2) DEFAULT 0',
        'ALTER TABLE products ADD COLUMN IF NOT EXISTS purchase_price DECIMAL(15,2)',
        'ALTER TABLE products ADD COLUMN IF NOT EXISTS price_purchase DECIMAL(15,2) DEFAULT 0',
        'ALTER TABLE products ADD COLUMN IF NOT EXISTS price_sale DECIMAL(15,2) DEFAULT 0',
        // ============================================
        // INVENTORY_MOVEMENTS: missing columns
        // ============================================
        'ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS movement_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
        'ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS document_type VARCHAR(50) DEFAULT \'adjustment\'',
        'ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS document_id INTEGER',
        'ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS cost_price DECIMAL(15,2)',
        'ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS notes TEXT',
        // ============================================
        // SALES: missing columns for sync/mobile
        // ============================================
        'ALTER TABLE sales ADD COLUMN IF NOT EXISTS source_device VARCHAR(100)',
        'ALTER TABLE sales ADD COLUMN IF NOT EXISTS synced_to_desktop BOOLEAN DEFAULT false',
        'ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_id INTEGER',
        'ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5,2) DEFAULT 0',
        'ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(15,2) DEFAULT 0',
        'ALTER TABLE sales ADD COLUMN IF NOT EXISTS vat_amount DECIMAL(15,2) DEFAULT 0',
        'ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_type VARCHAR(50)',
        'ALTER TABLE sales ADD COLUMN IF NOT EXISTS shift_id INTEGER',
        // ============================================
        // WAREHOUSES: missing columns
        // ============================================
        'ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS code VARCHAR(100)',
        'ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS address TEXT',
        'ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS responsible_person VARCHAR(255)',
        'ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,8)',
        'ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS longitude DECIMAL(11,8)',
        'ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS phone VARCHAR(50)',
        'ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS email VARCHAR(255)',
        'ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS working_hours VARCHAR(255)',
        'ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS capacity DECIMAL(15,2)',
        'ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS license_id INTEGER',
        // ============================================
        // LICENSES: missing columns
        // ============================================
        'ALTER TABLE licenses ADD COLUMN IF NOT EXISTS organization_id INTEGER',
        'ALTER TABLE licenses ADD COLUMN IF NOT EXISTS server_api_key VARCHAR(255)',
        'ALTER TABLE licenses ADD COLUMN IF NOT EXISTS server_url VARCHAR(500)',
        'ALTER TABLE licenses ADD COLUMN IF NOT EXISTS server_type VARCHAR(50)',
        'ALTER TABLE licenses ADD COLUMN IF NOT EXISTS metadata JSONB',
        'ALTER TABLE licenses ADD COLUMN IF NOT EXISTS product_name VARCHAR(255)',
        // ============================================
        // COUNTERPARTIES: missing columns
        // ============================================
        'ALTER TABLE counterparties ADD COLUMN IF NOT EXISTS license_id INTEGER',
        'ALTER TABLE counterparties ADD COLUMN IF NOT EXISTS type VARCHAR(50)',
        // ============================================
        // SHIFTS: missing columns
        // ============================================
        'ALTER TABLE shifts ADD COLUMN IF NOT EXISTS license_id INTEGER',
        // ============================================
        // CUSTOMERS: missing columns
        // ============================================
        'ALTER TABLE customers ADD COLUMN IF NOT EXISTS loyalty_points DECIMAL(10,2) DEFAULT 0',
        'ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_purchases DECIMAL(15,2) DEFAULT 0',
        'ALTER TABLE customers ADD COLUMN IF NOT EXISTS visit_count INTEGER DEFAULT 0',
        'ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_visit TIMESTAMP',
        'ALTER TABLE customers ADD COLUMN IF NOT EXISTS birthday DATE',
        'ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes TEXT',
        // ============================================
        // STOCK_BALANCES table (used by import/warehouse routes)
        // ============================================
        `CREATE TABLE IF NOT EXISTS stock_balances (
            id SERIAL PRIMARY KEY,
            product_id INTEGER,
            warehouse_id INTEGER,
            quantity DECIMAL(15,3) DEFAULT 0,
            last_movement_date TIMESTAMP,
            organization_id INTEGER,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
    ];

    for (const q of alterQueries) {
        try { await pool.query(q); } catch (e) { /* ignore */ }
    }

    // Ensure RBAC tables exist
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS roles (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) UNIQUE NOT NULL,
                code VARCHAR(50) UNIQUE,
                description TEXT,
                is_system BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_roles (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, role_id)
            )
        `);
    } catch (e) { /* ignore */ }

    // Create default admin user if no users exist
    try {
        const existingUsers = await pool.query('SELECT COUNT(*) as cnt FROM users');
        if (parseInt(existingUsers.rows[0].cnt) === 0) {
            const adminPasswordHash = await bcrypt.hash('admin', 10);
            const adminResult = await pool.query(`
                INSERT INTO users (username, email, password_hash, full_name, role, is_active, user_level, user_type)
                VALUES ('admin', 'admin@smartpos.local', $1, 'Администратор', 'Администратор', true, 'admin', 'owner')
                ON CONFLICT (username) DO NOTHING
                RETURNING id
            `, [adminPasswordHash]);

            if (adminResult.rows.length > 0) {
                try {
                    const adminRoleResult = await pool.query('SELECT id FROM roles WHERE code = $1', ['admin']);
                    if (adminRoleResult.rows.length > 0) {
                        await pool.query(
                            'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                            [adminResult.rows[0].id, adminRoleResult.rows[0].id]
                        );
                    }
                } catch (e) { /* ignore */ }
                console.log('  ✓ default admin user created (admin/admin)');
            }
        }
    } catch (e) {
        console.log('  ⚠️ Could not create default admin:', e.message);
    }

    // Ensure generate_license_key() function exists
    try {
        await pool.query(`
            CREATE OR REPLACE FUNCTION generate_license_key()
            RETURNS VARCHAR(255) AS $$
            DECLARE
                key_part1 TEXT;
                key_part2 TEXT;
                key_part3 TEXT;
                key_part4 TEXT;
                full_key TEXT;
            BEGIN
                key_part1 := upper(substring(md5(random()::text) from 1 for 4));
                key_part2 := upper(substring(md5(random()::text) from 1 for 4));
                key_part3 := upper(substring(md5(random()::text) from 1 for 4));
                key_part4 := upper(substring(md5(random()::text) from 1 for 4));
                full_key := key_part1 || '-' || key_part2 || '-' || key_part3 || '-' || key_part4;
                WHILE EXISTS (SELECT 1 FROM licenses WHERE license_key = full_key) LOOP
                    key_part1 := upper(substring(md5(random()::text) from 1 for 4));
                    key_part2 := upper(substring(md5(random()::text) from 1 for 4));
                    key_part3 := upper(substring(md5(random()::text) from 1 for 4));
                    key_part4 := upper(substring(md5(random()::text) from 1 for 4));
                    full_key := key_part1 || '-' || key_part2 || '-' || key_part3 || '-' || key_part4;
                END LOOP;
                RETURN full_key;
            END;
            $$ LANGUAGE plpgsql
        `);
        console.log('  ✓ generate_license_key() function');
    } catch (e) {
        console.log('  ⚠️ generate_license_key:', e.message);
    }

    // Ensure license_history table exists
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS license_history (
                id SERIAL PRIMARY KEY,
                license_id INTEGER REFERENCES licenses(id) ON DELETE CASCADE,
                action VARCHAR(50) NOT NULL,
                details JSONB,
                performed_by INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✓ license_history table');
    } catch (e) { /* ignore */ }

    // Ensure inventory_movements table exists (CRITICAL for stock management)
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS inventory_movements (
                id SERIAL PRIMARY KEY,
                product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
                warehouse_id INTEGER REFERENCES warehouses(id),
                document_type VARCHAR(50) DEFAULT 'adjustment',
                quantity DECIMAL(15, 3) NOT NULL DEFAULT 0,
                user_id INTEGER REFERENCES users(id),
                license_id INTEGER,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await pool.query('CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_inventory_movements_warehouse ON inventory_movements(warehouse_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_inventory_movements_license ON inventory_movements(license_id)');
        console.log('  ✓ inventory_movements table');
    } catch (e) {
        console.log('  ⚠️ inventory_movements:', e.message);
    }

    // Ensure products table has all required columns
    const productColumns = [
        'ALTER TABLE products ADD COLUMN IF NOT EXISTS price_purchase DECIMAL(15, 2) DEFAULT 0',
        'ALTER TABLE products ADD COLUMN IF NOT EXISTS price_sale DECIMAL(15, 2) DEFAULT 0',
        'ALTER TABLE products ADD COLUMN IF NOT EXISTS price_retail DECIMAL(15, 2) DEFAULT 0',
        'ALTER TABLE products ADD COLUMN IF NOT EXISTS vat_rate DECIMAL(5, 2) DEFAULT 20',
        'ALTER TABLE products ADD COLUMN IF NOT EXISTS license_id INTEGER',
    ];
    for (const q of productColumns) {
        try { await pool.query(q); } catch (e) { /* ignore */ }
    }
    console.log('  ✓ products missing columns');

    // Ensure sales has license_id and vat_amount
    const salesColumns = [
        'ALTER TABLE sales ADD COLUMN IF NOT EXISTS license_id INTEGER',
        'ALTER TABLE sales ADD COLUMN IF NOT EXISTS vat_amount DECIMAL(15, 2) DEFAULT 0',
    ];
    for (const q of salesColumns) {
        try { await pool.query(q); } catch (e) { /* ignore */ }
    }
    console.log('  ✓ sales missing columns');

    // Ensure purchases has final_amount and license_id
    const purchasesColumns = [
        'ALTER TABLE purchases ADD COLUMN IF NOT EXISTS final_amount DECIMAL(15, 2) DEFAULT 0',
        'ALTER TABLE purchases ADD COLUMN IF NOT EXISTS license_id INTEGER',
    ];
    for (const q of purchasesColumns) {
        try { await pool.query(q); } catch (e) { /* ignore */ }
    }
    console.log('  ✓ purchases missing columns');

    // Ensure warehouses has license_id column
    try {
        await pool.query('ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS license_id INTEGER');
    } catch (e) { /* ignore */ }

    // Ensure all required columns exist on licenses table
    const licenseColumns = [
        { name: 'customer_name', type: "VARCHAR(255)" },
        { name: 'customer_email', type: "VARCHAR(255)" },
        { name: 'customer_phone', type: "VARCHAR(50)" },
        { name: 'customer_username', type: "VARCHAR(100)" },
        { name: 'customer_password_hash', type: "VARCHAR(255)" },
        { name: 'customer_last_login', type: "TIMESTAMP" },
        { name: 'company_name', type: "VARCHAR(255)" },
        { name: 'license_type', type: "VARCHAR(50) DEFAULT 'monthly'" },
        { name: 'max_devices', type: "INTEGER DEFAULT 1" },
        { name: 'max_users', type: "INTEGER DEFAULT 5" },
        { name: 'max_pos_terminals', type: "INTEGER DEFAULT 1" },
        { name: 'expires_at', type: "TIMESTAMP" },
        { name: 'trial_days', type: "INTEGER DEFAULT 0" },
        { name: 'features', type: "JSONB DEFAULT '{}'::jsonb" },
        { name: 'server_type', type: "VARCHAR(20) DEFAULT 'cloud'" },
        { name: 'server_url', type: "VARCHAR(500)" },
        { name: 'server_api_key', type: "VARCHAR(255)" },
        { name: 'created_by', type: "INTEGER" }
    ];
    for (const col of licenseColumns) {
        try {
            await pool.query(`ALTER TABLE licenses ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
        } catch (e) { /* ignore */ }
    }
    console.log('  ✓ licenses columns checked');

    // Ensure license_activations table exists
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS license_activations (
                id SERIAL PRIMARY KEY,
                license_id INTEGER REFERENCES licenses(id),
                device_id VARCHAR(255) NOT NULL,
                device_type VARCHAR(50),
                device_name VARCHAR(255),
                device_fingerprint VARCHAR(255),
                last_ip VARCHAR(50),
                activated_at TIMESTAMP DEFAULT NOW(),
                last_seen TIMESTAMP DEFAULT NOW(),
                is_active BOOLEAN DEFAULT true,
                deactivated_at TIMESTAMP,
                deactivation_reason TEXT
            )
        `);
        console.log('  ✓ license_activations table');
    } catch (e) { /* ignore */ }

    // Fix: ensure existing admin user has owner type for admin panel access
    try {
        await pool.query(`
            UPDATE users SET user_type = 'owner', user_level = 'admin'
            WHERE username = 'admin' AND (user_type IS NULL OR user_type = 'employee')
        `);
    } catch (e) { /* ignore */ }

    // ============================================================================
    // INVENTORY TABLES & FUNCTIONS
    // ============================================================================

    // Ensure inventories table exists
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS inventories (
                id SERIAL PRIMARY KEY,
                document_number VARCHAR(50) UNIQUE NOT NULL DEFAULT '',
                document_date DATE NOT NULL DEFAULT CURRENT_DATE,
                warehouse_id INT REFERENCES warehouses(id),
                status VARCHAR(20) NOT NULL DEFAULT 'draft',
                responsible_user_id INT REFERENCES users(id),
                start_date TIMESTAMP,
                end_date TIMESTAMP,
                notes TEXT,
                created_by INT REFERENCES users(id),
                license_id INT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('  ✓ inventories table');
    } catch (e) { /* already exists */ }

    // Ensure inventory_items table exists
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS inventory_items (
                id SERIAL PRIMARY KEY,
                inventory_id INT REFERENCES inventories(id) ON DELETE CASCADE,
                product_id INT REFERENCES products(id),
                expected_quantity DECIMAL(10, 3) NOT NULL DEFAULT 0,
                actual_quantity DECIMAL(10, 3),
                difference DECIMAL(10, 3) GENERATED ALWAYS AS (actual_quantity - expected_quantity) STORED,
                notes TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(inventory_id, product_id)
            )
        `);
        console.log('  ✓ inventory_items table');
    } catch (e) { /* already exists */ }

    // Ensure inventory_adjustments table exists
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS inventory_adjustments (
                id SERIAL PRIMARY KEY,
                inventory_id INT REFERENCES inventories(id),
                product_id INT REFERENCES products(id),
                warehouse_id INT REFERENCES warehouses(id),
                quantity_change DECIMAL(10, 3) NOT NULL,
                reason VARCHAR(50) NOT NULL,
                cost_impact DECIMAL(12, 2),
                notes TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('  ✓ inventory_adjustments table');
    } catch (e) { /* already exists */ }

    // Ensure generate_inventory_number() trigger function exists
    try {
        await pool.query(`
            CREATE OR REPLACE FUNCTION generate_inventory_number()
            RETURNS TRIGGER AS $t$
            BEGIN
                IF NEW.document_number IS NULL OR NEW.document_number = '' THEN
                    NEW.document_number := 'INV-' ||
                        TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' ||
                        LPAD(NEXTVAL('inventories_id_seq')::TEXT, 6, '0');
                END IF;
                RETURN NEW;
            END;
            $t$ LANGUAGE plpgsql
        `);
        // Create trigger if not exists
        await pool.query(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_inventory_number'
                ) THEN
                    CREATE TRIGGER trg_inventory_number
                        BEFORE INSERT ON inventories
                        FOR EACH ROW
                        EXECUTE FUNCTION generate_inventory_number();
                END IF;
            END $$
        `);
        console.log('  ✓ generate_inventory_number() function & trigger');
    } catch (e) {
        console.log('  ⚠️ generate_inventory_number:', e.message);
    }

    // Ensure start_inventory() function exists
    try {
        await pool.query(`
            CREATE OR REPLACE FUNCTION start_inventory(p_inventory_id INT)
            RETURNS VOID AS $fn$
            DECLARE
                v_warehouse_id INT;
            BEGIN
                SELECT warehouse_id INTO v_warehouse_id
                FROM inventories
                WHERE id = p_inventory_id;

                INSERT INTO inventory_items (inventory_id, product_id, expected_quantity, actual_quantity)
                SELECT
                    p_inventory_id,
                    product_id,
                    quantity,
                    NULL
                FROM products
                WHERE quantity > 0 OR id IN (
                    SELECT DISTINCT product_id
                    FROM sales s
                    JOIN sale_items si ON s.id = si.sale_id
                    WHERE s.warehouse_id = v_warehouse_id
                )
                ON CONFLICT (inventory_id, product_id) DO NOTHING;

                UPDATE inventories
                SET status = 'in_progress',
                    start_date = NOW()
                WHERE id = p_inventory_id;
            END;
            $fn$ LANGUAGE plpgsql
        `);
        console.log('  ✓ start_inventory() function');
    } catch (e) {
        console.log('  ⚠️ start_inventory:', e.message);
    }

    // Ensure complete_inventory() function exists
    try {
        await pool.query(`
            CREATE OR REPLACE FUNCTION complete_inventory(p_inventory_id INT)
            RETURNS TABLE (
                total_items INT,
                items_with_difference INT,
                total_surplus DECIMAL,
                total_shortage DECIMAL
            ) AS $fn$
            DECLARE
                v_warehouse_id INT;
                v_item RECORD;
            BEGIN
                SELECT warehouse_id INTO v_warehouse_id
                FROM inventories
                WHERE id = p_inventory_id;

                FOR v_item IN
                    SELECT ii.product_id, ii.difference, p.price_sale as price
                    FROM inventory_items ii
                    JOIN products p ON ii.product_id = p.id
                    WHERE ii.inventory_id = p_inventory_id
                    AND ii.difference IS NOT NULL
                    AND ii.difference != 0
                LOOP
                    INSERT INTO inventory_adjustments (
                        inventory_id, product_id, warehouse_id,
                        quantity_change, reason, cost_impact
                    ) VALUES (
                        p_inventory_id,
                        v_item.product_id,
                        v_warehouse_id,
                        v_item.difference,
                        CASE
                            WHEN v_item.difference > 0 THEN 'surplus'
                            ELSE 'shortage'
                        END,
                        v_item.difference * v_item.price
                    );

                    UPDATE products
                    SET quantity = quantity + v_item.difference
                    WHERE id = v_item.product_id;
                END LOOP;

                UPDATE inventories
                SET status = 'completed',
                    end_date = NOW()
                WHERE id = p_inventory_id;

                RETURN QUERY
                SELECT
                    COUNT(*)::INT,
                    COUNT(*) FILTER (WHERE difference != 0)::INT,
                    COALESCE(SUM(difference) FILTER (WHERE difference > 0), 0),
                    COALESCE(ABS(SUM(difference) FILTER (WHERE difference < 0)), 0)
                FROM inventory_items
                WHERE inventory_id = p_inventory_id
                AND difference IS NOT NULL;
            END;
            $fn$ LANGUAGE plpgsql
        `);
        console.log('  ✓ complete_inventory() function');
    } catch (e) {
        console.log('  ⚠️ complete_inventory:', e.message);
    }

    // ============================================================================
    // MISSING TABLES REFERENCED BY ROUTES
    // ============================================================================

    // Loyalty tables
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS loyalty_programs (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                points_per_ruble DECIMAL(5, 2) DEFAULT 1,
                min_purchase_amount DECIMAL(10, 2) DEFAULT 0,
                points_to_ruble_ratio DECIMAL(5, 2) DEFAULT 1,
                expiry_months INT DEFAULT 12,
                is_active BOOLEAN DEFAULT TRUE,
                start_date DATE DEFAULT CURRENT_DATE,
                end_date DATE,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('  ✓ loyalty_programs table');
    } catch (e) { /* ignore */ }

    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS loyalty_settings (
                id SERIAL PRIMARY KEY,
                organization_id INTEGER UNIQUE,
                points_per_currency DECIMAL(5, 2) DEFAULT 1,
                min_purchase_amount DECIMAL(10, 2) DEFAULT 0,
                points_to_currency_ratio DECIMAL(5, 2) DEFAULT 1,
                expiry_months INT DEFAULT 12,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);
        // Add organization_id column and unique constraint if table already exists
        try {
            await pool.query(`ALTER TABLE loyalty_settings ADD COLUMN IF NOT EXISTS organization_id INTEGER`);
            await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_settings_org ON loyalty_settings(organization_id)`);
        } catch (e) { /* ignore */ }
        // Insert default settings if empty
        await pool.query(`
            INSERT INTO loyalty_settings (organization_id, points_per_currency) VALUES (1, 1)
            ON CONFLICT (organization_id) DO NOTHING
        `);
        console.log('  ✓ loyalty_settings table');
    } catch (e) { /* ignore */ }

    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS loyalty_tiers (
                id SERIAL PRIMARY KEY,
                name VARCHAR(50) NOT NULL,
                min_purchases_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
                discount_percent DECIMAL(5, 2) DEFAULT 0,
                points_multiplier DECIMAL(3, 2) DEFAULT 1,
                color VARCHAR(20) DEFAULT '#4472C4',
                benefits JSONB,
                position INT NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('  ✓ loyalty_tiers table');
    } catch (e) { /* ignore */ }

    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS customer_loyalty (
                id SERIAL PRIMARY KEY,
                customer_id INT REFERENCES counterparties(id),
                program_id INT,
                total_points DECIMAL(10, 2) DEFAULT 0,
                earned_points DECIMAL(10, 2) DEFAULT 0,
                spent_points DECIMAL(10, 2) DEFAULT 0,
                tier_id INT,
                tier_discount DECIMAL(5, 2) DEFAULT 0,
                joined_at TIMESTAMP DEFAULT NOW(),
                last_purchase_at TIMESTAMP,
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(customer_id)
            )
        `);
        console.log('  ✓ customer_loyalty table');
    } catch (e) { /* ignore */ }

    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS loyalty_transactions (
                id SERIAL PRIMARY KEY,
                customer_id INT REFERENCES counterparties(id),
                transaction_type VARCHAR(20) NOT NULL,
                points DECIMAL(10, 2) NOT NULL,
                sale_id INT,
                description TEXT,
                balance_after DECIMAL(10, 2) NOT NULL DEFAULT 0,
                expires_at TIMESTAMP,
                created_by INT REFERENCES users(id),
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('  ✓ loyalty_transactions table');
    } catch (e) { /* ignore */ }

    // Customer segments
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS customer_segments (
                id SERIAL PRIMARY KEY,
                code VARCHAR(20) UNIQUE NOT NULL,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                r_min INT,
                r_max INT,
                f_min INT,
                f_max INT,
                m_min INT,
                m_max INT,
                color VARCHAR(20) DEFAULT '#4472C4',
                marketing_strategy TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('  ✓ customer_segments table');
    } catch (e) { /* ignore */ }

    // Email campaigns
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS email_campaigns (
                id SERIAL PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                subject VARCHAR(200),
                body TEXT,
                segment_code VARCHAR(20),
                status VARCHAR(20) DEFAULT 'draft',
                scheduled_at TIMESTAMP,
                sent_at TIMESTAMP,
                total_recipients INT DEFAULT 0,
                opened INT DEFAULT 0,
                clicked INT DEFAULT 0,
                bounced INT DEFAULT 0,
                created_by INT REFERENCES users(id),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('  ✓ email_campaigns table');
    } catch (e) { /* ignore */ }

    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS email_recipients (
                id SERIAL PRIMARY KEY,
                campaign_id INT,
                customer_id INT,
                email VARCHAR(200) NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                sent_at TIMESTAMP,
                opened_at TIMESTAMP,
                clicked_at TIMESTAMP,
                error_message TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('  ✓ email_recipients table');
    } catch (e) { /* ignore */ }

    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS email_templates (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                subject VARCHAR(200) NOT NULL,
                body TEXT NOT NULL,
                category VARCHAR(50),
                variables JSONB,
                is_active BOOLEAN DEFAULT TRUE,
                created_by INT REFERENCES users(id),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('  ✓ email_templates table');
    } catch (e) { /* ignore */ }

    // Contracts
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS contracts (
                id SERIAL PRIMARY KEY,
                contract_number VARCHAR(100) UNIQUE,
                contract_date DATE DEFAULT CURRENT_DATE,
                counterparty_id INT REFERENCES counterparties(id),
                type VARCHAR(50),
                amount DECIMAL(15, 2) DEFAULT 0,
                start_date DATE,
                end_date DATE,
                status VARCHAR(50) DEFAULT 'active',
                terms TEXT,
                notes TEXT,
                created_by INT REFERENCES users(id),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('  ✓ contracts table');
    } catch (e) { /* ignore */ }

    // Alert settings and history
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS alert_settings (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id),
                alert_type VARCHAR(50),
                threshold DECIMAL(15, 2),
                email_enabled BOOLEAN DEFAULT false,
                telegram_enabled BOOLEAN DEFAULT false,
                push_enabled BOOLEAN DEFAULT false,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('  ✓ alert_settings table');
    } catch (e) { /* ignore */ }

    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS alert_history (
                id SERIAL PRIMARY KEY,
                alert_type VARCHAR(50),
                severity VARCHAR(20) DEFAULT 'info',
                title VARCHAR(255),
                message TEXT,
                data JSONB,
                is_resolved BOOLEAN DEFAULT false,
                resolved_at TIMESTAMP,
                resolved_by INT REFERENCES users(id),
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('  ✓ alert_history table');
    } catch (e) { /* ignore */ }

    // Notifications
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id),
                type VARCHAR(50),
                title VARCHAR(255),
                message TEXT,
                data JSONB,
                is_read BOOLEAN DEFAULT false,
                read_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('  ✓ notifications table');
    } catch (e) { /* ignore */ }

    // Deliveries
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS deliveries (
                id SERIAL PRIMARY KEY,
                delivery_number VARCHAR(100) UNIQUE,
                delivery_date DATE DEFAULT CURRENT_DATE,
                purchase_id INT,
                supplier_id INT REFERENCES counterparties(id),
                warehouse_id INT REFERENCES warehouses(id),
                status VARCHAR(50) DEFAULT 'pending',
                total_amount DECIMAL(15, 2) DEFAULT 0,
                notes TEXT,
                created_by INT REFERENCES users(id),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('  ✓ deliveries table');
    } catch (e) { /* ignore */ }

    // Stock movements
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS stock_movements (
                id SERIAL PRIMARY KEY,
                product_id INT REFERENCES products(id),
                warehouse_id INT REFERENCES warehouses(id),
                movement_type VARCHAR(50) NOT NULL,
                quantity DECIMAL(10, 3) NOT NULL,
                reference_type VARCHAR(50),
                reference_id INT,
                notes TEXT,
                created_by INT REFERENCES users(id),
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('  ✓ stock_movements table');
    } catch (e) { /* ignore */ }

    console.log('✅ Проверка колонок и таблиц завершена');
}
