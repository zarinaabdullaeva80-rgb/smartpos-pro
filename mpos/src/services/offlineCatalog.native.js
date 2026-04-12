import * as SQLite from 'expo-sqlite';

/**
 * Native-реализация офлайн-каталога (expo-sqlite)
 * Metro подхватит этот файл для iOS/Android
 */
class OfflineCatalogService {
    static db = null;
    static isInitialized = false;

    static async init() {
        if (this.isInitialized) return;
        try {
            this.db = await SQLite.openDatabaseAsync('pos_catalog.db');
            await this.db.execAsync(`
                CREATE TABLE IF NOT EXISTS products (
                    id INTEGER PRIMARY KEY, code TEXT, name TEXT NOT NULL, barcode TEXT,
                    category_id INTEGER, price_sale REAL DEFAULT 0, price_purchase REAL DEFAULT 0,
                    quantity REAL DEFAULT 0, unit TEXT DEFAULT 'шт', active INTEGER DEFAULT 1,
                    synced_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS categories (
                    id INTEGER PRIMARY KEY, name TEXT NOT NULL, parent_id INTEGER, synced_at TEXT
                );
                CREATE TABLE IF NOT EXISTS pending_sales (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT NOT NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP, synced INTEGER DEFAULT 0
                );
                CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
                CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);
                CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
            `);
            this.isInitialized = true;
            console.log('[OfflineCatalog] Database initialized');
        } catch (error) {
            console.error('[OfflineCatalog] Init error:', error);
        }
    }

    static async syncProducts(products) {
        if (!this.db) await this.init();
        try {
            const now = new Date().toISOString();
            await this.db.execAsync('DELETE FROM products');
            for (const product of products) {
                await this.db.runAsync(
                    `INSERT INTO products (id, code, name, barcode, category_id, price_sale, price_purchase, quantity, unit, active, synced_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [product.id, product.code || '', product.name || 'Без названия', product.barcode || '',
                     product.category_id || null, product.price_sale || 0, product.price_purchase || 0,
                     product.quantity || 0, product.unit || 'шт', product.active ? 1 : 0, now]
                );
            }
            console.log(`[OfflineCatalog] Synced ${products.length} products`);
            return true;
        } catch (error) { console.error('[OfflineCatalog] Sync error:', error); return false; }
    }

    static async syncCategories(categories) {
        if (!this.db) await this.init();
        try {
            const now = new Date().toISOString();
            await this.db.execAsync('DELETE FROM categories');
            for (const cat of categories) {
                await this.db.runAsync(
                    'INSERT INTO categories (id, name, parent_id, synced_at) VALUES (?, ?, ?, ?)',
                    [cat.id, cat.name, cat.parent_id || null, now]
                );
            }
            return true;
        } catch (error) { return false; }
    }

    static async getProducts(filters = {}) {
        if (!this.db) await this.init();
        try {
            let query = 'SELECT * FROM products WHERE active = 1';
            const params = [];
            if (filters.search) {
                query += ' AND (name LIKE ? OR code LIKE ? OR barcode LIKE ?)';
                const s = `%${filters.search}%`;
                params.push(s, s, s);
            }
            if (filters.categoryId) { query += ' AND category_id = ?'; params.push(filters.categoryId); }
            query += ' ORDER BY name ASC LIMIT 200';
            return (await this.db.getAllAsync(query, params)) || [];
        } catch (error) { return []; }
    }

    static async getProductByBarcode(barcode) {
        if (!this.db) await this.init();
        try {
            return (await this.db.getFirstAsync('SELECT * FROM products WHERE barcode = ? AND active = 1', [barcode])) || null;
        } catch (error) { return null; }
    }

    static async getCategories() {
        if (!this.db) await this.init();
        try { return (await this.db.getAllAsync('SELECT * FROM categories ORDER BY name ASC')) || []; }
        catch (error) { return []; }
    }

    static async savePendingSale(saleData) {
        if (!this.db) await this.init();
        try {
            await this.db.runAsync('INSERT INTO pending_sales (data) VALUES (?)', [JSON.stringify(saleData)]);
            return true;
        } catch (error) { return false; }
    }

    static async getPendingSales() {
        if (!this.db) await this.init();
        try {
            const result = await this.db.getAllAsync('SELECT * FROM pending_sales WHERE synced = 0 ORDER BY created_at ASC');
            return (result || []).map(row => ({ id: row.id, data: JSON.parse(row.data), created_at: row.created_at }));
        } catch (error) { return []; }
    }

    static async markSaleSynced(id) {
        if (!this.db) await this.init();
        try { await this.db.runAsync('UPDATE pending_sales SET synced = 1 WHERE id = ?', [id]); return true; }
        catch (error) { return false; }
    }

    static async getStats() {
        if (!this.db) await this.init();
        try {
            const products = await this.db.getFirstAsync('SELECT COUNT(*) as count FROM products WHERE active = 1');
            const categories = await this.db.getFirstAsync('SELECT COUNT(*) as count FROM categories');
            const pending = await this.db.getFirstAsync('SELECT COUNT(*) as count FROM pending_sales WHERE synced = 0');
            const lastSync = await this.db.getFirstAsync('SELECT MAX(synced_at) as last FROM products');
            return {
                productsCount: products?.count || 0, categoriesCount: categories?.count || 0,
                pendingSalesCount: pending?.count || 0, lastSyncAt: lastSync?.last || null,
            };
        } catch (error) { return { productsCount: 0, categoriesCount: 0, pendingSalesCount: 0, lastSyncAt: null }; }
    }

    static async mergeDeltaProducts(products) {
        if (!this.db) await this.init();
        try {
            const now = new Date().toISOString();
            for (const product of products) {
                await this.db.runAsync(
                    `INSERT INTO products (id, code, name, barcode, category_id, price_sale, price_purchase, quantity, unit, active, synced_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                     ON CONFLICT(id) DO UPDATE SET
                       name=excluded.name, barcode=excluded.barcode, price_sale=excluded.price_sale,
                       price_purchase=excluded.price_purchase, quantity=excluded.quantity,
                       unit=excluded.unit, active=excluded.active, synced_at=excluded.synced_at`,
                    [product.id, product.code || '', product.name || 'Без названия', product.barcode || '',
                     product.category_id || null, product.price_sale || 0, product.price_purchase || 0,
                     product.stock_quantity ?? product.quantity ?? 0, product.unit || 'шт',
                     product.is_active !== false ? 1 : 0, now]
                );
            }
            return true;
        } catch (error) { return false; }
    }

    static async mergeInventory(inventory) {
        if (!this.db) await this.init();
        try {
            for (const item of inventory) {
                await this.db.runAsync('UPDATE products SET quantity = ?, synced_at = ? WHERE id = ?',
                    [item.stock_quantity ?? 0, new Date().toISOString(), item.product_id]);
            }
            return true;
        } catch (error) { return false; }
    }

    static async clearAll() {
        if (!this.db) await this.init();
        try {
            await this.db.execAsync('DELETE FROM products; DELETE FROM categories; DELETE FROM pending_sales WHERE synced = 1;');
            return true;
        } catch (error) { return false; }
    }
}

export default OfflineCatalogService;
