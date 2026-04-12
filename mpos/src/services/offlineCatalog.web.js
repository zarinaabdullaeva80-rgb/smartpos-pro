/**
 * Веб-реализация офлайн-каталога (localStorage)
 * Metro автоматически подхватит .web.js вместо .js для веб-платформы
 */
class OfflineCatalogService {
    static getKey(name) { return `offline_catalog_${name}`; }

    static async init() { console.log('[OfflineCatalog/Web] Ready'); }

    static async syncProducts(products) {
        try {
            localStorage.setItem(this.getKey('products'), JSON.stringify(products));
            localStorage.setItem(this.getKey('products_synced'), new Date().toISOString());
            console.log(`[OfflineCatalog/Web] Synced ${products.length} products`);
            return true;
        } catch (e) { console.error('[OfflineCatalog/Web] Sync error:', e); return false; }
    }

    static async syncCategories(categories) {
        try {
            localStorage.setItem(this.getKey('categories'), JSON.stringify(categories));
            return true;
        } catch (e) { return false; }
    }

    static async getProducts(filters = {}) {
        try {
            let products = JSON.parse(localStorage.getItem(this.getKey('products')) || '[]');
            if (filters.search) {
                const s = filters.search.toLowerCase();
                products = products.filter(p =>
                    (p.name || '').toLowerCase().includes(s) ||
                    (p.code || '').toLowerCase().includes(s) ||
                    (p.barcode || '').includes(s)
                );
            }
            if (filters.categoryId) {
                products = products.filter(p => p.category_id == filters.categoryId);
            }
            return products.filter(p => p.is_active !== false && p.active !== 0).slice(0, 200);
        } catch (e) { return []; }
    }

    static async getProductByBarcode(barcode) {
        const products = await this.getProducts();
        return products.find(p => p.barcode === barcode) || null;
    }

    static async getCategories() {
        try {
            return JSON.parse(localStorage.getItem(this.getKey('categories')) || '[]');
        } catch (e) { return []; }
    }

    static async savePendingSale(saleData) {
        try {
            const pending = JSON.parse(localStorage.getItem(this.getKey('pending_sales')) || '[]');
            pending.push({ id: Date.now(), data: saleData, created_at: new Date().toISOString(), synced: false });
            localStorage.setItem(this.getKey('pending_sales'), JSON.stringify(pending));
            return true;
        } catch (e) { return false; }
    }

    static async getPendingSales() {
        try {
            const pending = JSON.parse(localStorage.getItem(this.getKey('pending_sales')) || '[]');
            return pending.filter(s => !s.synced);
        } catch (e) { return []; }
    }

    static async markSaleSynced(id) {
        try {
            const pending = JSON.parse(localStorage.getItem(this.getKey('pending_sales')) || '[]');
            const updated = pending.map(s => s.id === id ? { ...s, synced: true } : s);
            localStorage.setItem(this.getKey('pending_sales'), JSON.stringify(updated));
            return true;
        } catch (e) { return false; }
    }

    static async getStats() {
        const products = await this.getProducts();
        const categories = await this.getCategories();
        const pending = await this.getPendingSales();
        return {
            productsCount: products.length,
            categoriesCount: categories.length,
            pendingSalesCount: pending.length,
            lastSyncAt: localStorage.getItem(this.getKey('products_synced')) || null,
        };
    }

    static async mergeDeltaProducts(products) {
        try {
            const existing = JSON.parse(localStorage.getItem(this.getKey('products')) || '[]');
            const map = new Map(existing.map(p => [p.id, p]));
            for (const product of products) {
                map.set(product.id, { ...map.get(product.id), ...product });
            }
            localStorage.setItem(this.getKey('products'), JSON.stringify([...map.values()]));
            return true;
        } catch (e) { return false; }
    }

    static async mergeInventory(inventory) {
        try {
            const existing = JSON.parse(localStorage.getItem(this.getKey('products')) || '[]');
            const map = new Map(existing.map(p => [p.id, p]));
            for (const item of inventory) {
                const p = map.get(item.product_id);
                if (p) p.quantity = item.stock_quantity ?? 0;
            }
            localStorage.setItem(this.getKey('products'), JSON.stringify([...map.values()]));
            return true;
        } catch (e) { return false; }
    }

    /**
     * Уменьшить остаток товара локально (при офлайн-продаже)
     * @param {number} productId - ID товара
     * @param {number} quantity - количество для вычитания
     */
    static async decrementStock(productId, quantity) {
        try {
            const products = JSON.parse(localStorage.getItem(this.getKey('products')) || '[]');
            const idx = products.findIndex(p => p.id === productId || p.id === String(productId));
            if (idx !== -1) {
                const current = products[idx].quantity || products[idx].available_quantity || 0;
                products[idx].quantity = Math.max(0, current - quantity);
                products[idx].available_quantity = products[idx].quantity;
                localStorage.setItem(this.getKey('products'), JSON.stringify(products));
                console.log(`[OfflineCatalog/Web] Stock decremented: product ${productId} -${quantity} → ${products[idx].quantity}`);
            }
            return true;
        } catch (e) {
            console.error('[OfflineCatalog/Web] decrementStock error:', e);
            return false;
        }
    }

    /**
     * Уменьшить остатки для пакета товаров (при офлайн-продаже)
     * @param {Array<{product_id: number, quantity: number}>} items
     */
    static async decrementStockBatch(items) {
        try {
            const products = JSON.parse(localStorage.getItem(this.getKey('products')) || '[]');
            const map = new Map(products.map(p => [String(p.id), p]));
            
            for (const item of items) {
                const p = map.get(String(item.product_id || item.id));
                if (p) {
                    const current = p.quantity || p.available_quantity || 0;
                    p.quantity = Math.max(0, current - (item.quantity || 1));
                    p.available_quantity = p.quantity;
                }
            }
            
            localStorage.setItem(this.getKey('products'), JSON.stringify([...map.values()]));
            console.log(`[OfflineCatalog/Web] Stock batch decremented: ${items.length} items`);
            return true;
        } catch (e) {
            console.error('[OfflineCatalog/Web] decrementStockBatch error:', e);
            return false;
        }
    }

    static async clearAll() {
        ['products', 'categories', 'products_synced'].forEach(k => localStorage.removeItem(this.getKey(k)));
        try {
            const pending = JSON.parse(localStorage.getItem(this.getKey('pending_sales')) || '[]');
            localStorage.setItem(this.getKey('pending_sales'), JSON.stringify(pending.filter(s => !s.synced)));
        } catch (e) {}
        return true;
    }
}

export default OfflineCatalogService;
