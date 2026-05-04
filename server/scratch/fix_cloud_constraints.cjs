const fetch = require('node-fetch');

async function fixCloudConstraints() {
    const res = await fetch('https://smartpos-pro-production.up.railway.app/api/license/admin-cleanup', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Sync-Secret': 'smartpos-sync-key-2026'
        },
        body: JSON.stringify({
            action: 'run_sql',
            sql: `
                -- 1. Drop old constraint if exists
                ALTER TABLE products DROP CONSTRAINT IF EXISTS products_code_key;
                ALTER TABLE products DROP CONSTRAINT IF EXISTS products_code_org_unique;
                
                -- 2. Add new composite unique constraint
                ALTER TABLE products ADD CONSTRAINT products_code_org_unique UNIQUE (code, organization_id);
                
                -- 3. Also for categories
                ALTER TABLE product_categories DROP CONSTRAINT IF EXISTS product_categories_name_key;
                ALTER TABLE product_categories DROP CONSTRAINT IF EXISTS product_categories_name_org_unique;
                ALTER TABLE product_categories ADD CONSTRAINT product_categories_name_org_unique UNIQUE (name, organization_id);
            `
        })
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}

fixCloudConstraints();
