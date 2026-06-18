const fs = require('fs');
const path = require('path');

const backupPath = path.join(__dirname, 'backups', 'manual', 'smartpos_manual_2026-06-16T04-14-21.sql');
const content = fs.readFileSync(backupPath, 'utf8');

// The COPY lines look like:
// COPY public.products (id, code, barcode, name, description, category_id, unit, price, price_purchase, price_sale, price_retail, purchase_price, quantity, vat_rate, min_stock, max_stock, is_active, image_url, license_id, organization_id, created_at, updated_at) FROM stdin;
// 1	CODE	BARCODE	NAME	...

let inProducts = false;
let countOrg11 = 0;
let lines = content.split('\n');

for (let line of lines) {
  if (line.startsWith('COPY public.products ')) {
    inProducts = true;
    continue;
  }
  if (inProducts && line === '\\.') {
    inProducts = false;
    continue;
  }
  
  if (inProducts) {
    // Assuming organization_id is the 20th column (index 19)
    // Actually let's just search for the tab-separated values.
    const parts = line.split('\t');
    // We can also just check if parts contains '11' in the organization_id column or just count all.
    // Let's just output the organization_ids we find
    const orgId = parts[19]; 
    if (orgId === '11') countOrg11++;
  }
}

console.log('Products in org 11:', countOrg11);
