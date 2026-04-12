// Скрипт замены fetch-вызовов на API-обёртки в оставшихся файлах
const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, '..', 'client-accounting', 'src', 'pages');

// Файлы с прямым fetch
const fetchFiles = {
    'Implementation.jsx': {
        apis: ['sync1CAPI', 'categoriesAPI', 'productsAPI', 'counterpartiesAPI'],
        replacements: [
            { from: "fetch('/api/sync1c/settings'", to: "sync1CAPI.getSettings()" },
            { from: "fetch('/api/sync1c/log?limit=5'", to: "sync1CAPI.getLog({ limit: 5 })" },
            { from: "fetch('/api/categories'", to: "categoriesAPI.getAll()" },
            { from: "fetch('/api/products?limit=1'", to: "productsAPI.getAll({ limit: 1 })" },
            { from: "fetch('/api/counterparties?limit=1'", to: "counterpartiesAPI.getAll({ limit: 1 })" },
        ]
    },
    'PermissionsManagement.jsx': {
        apis: ['permissionsAPI'],
        replacements: [
            { from: "fetch('/api/permissions/roles'", to: "permissionsAPI.getRoles()" },
            { from: "fetch('/api/permissions'", to: "permissionsAPI.getAll()" },
        ]
    },
    'RFMAnalysis.jsx': {
        apis: ['crmAPI'],
        replacements: [
            { from: "fetch('/api/crm/rfm/segments'", to: "crmAPI.getRFMSegments()" },
            { from: "fetch('/api/crm/rfm/segment-stats'", to: "crmAPI.getRFMSegmentStats()" },
            { from: "fetch('/api/crm/rfm/analysis'", to: "crmAPI.getRFMAnalysis()" },
        ]
    },
    'SalesPipeline.jsx': {
        apis: ['crmAPI'],
        replacements: [
            { from: "fetch('/api/crm/stages'", to: "crmAPI.getStages()" },
            { from: "fetch('/api/crm/deals?status=active'", to: "crmAPI.getDeals({ status: 'active' })" },
            { from: "fetch('/api/crm/deals'", to: "crmAPI.createDeal(" },
        ]
    },
    'Sync1CSettings.jsx': {
        apis: ['sync1CAPI', 'schedulerAPI'],
        replacements: [
            { from: "fetch('/api/sync1c/settings'", to: "sync1CAPI.getSettings()" },
            { from: "fetch('/api/sync1c/log?limit=20'", to: "sync1CAPI.getLog({ limit: 20 })" },
            { from: "fetch('/api/sync-status/overview'", to: "sync1CAPI.getOverview()" },
            { from: "fetch('/api/sync1c/test-connection'", to: "sync1CAPI.testConnection()" },
            { from: "fetch('/api/scheduler/trigger'", to: "schedulerAPI.triggerSync()" },
            { from: "fetch('/api/scheduler/reload'", to: "schedulerAPI.reload()" },
        ]
    },
    'WarehouseMap.jsx': {
        apis: ['wmsAPI'],
        replacements: [
            { from: "fetch('/api/wms/locations'", to: "wmsAPI.getLocations()" },
        ]
    }
};

let updated = 0;

for (const [fileName, config] of Object.entries(fetchFiles)) {
    const filePath = path.join(pagesDir, fileName);

    if (!fs.existsSync(filePath)) {
        console.log(`SKIP: ${fileName} — не найден`);
        continue;
    }

    let content = fs.readFileSync(filePath, 'utf-8');

    // Добавить import если ещё нет
    if (!content.includes("from '../services/api'")) {
        const importLine = `import { ${config.apis.join(', ')} } from '../services/api';\n`;
        const lines = content.split('\n');
        let lastImportLine = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().startsWith('import ') && lines[i].includes(' from ')) {
                lastImportLine = i;
            }
        }
        if (lastImportLine >= 0) {
            lines.splice(lastImportLine + 1, 0, importLine.trim());
        }
        content = lines.join('\n');
    } else {
        // Уже имеет import из api, но может не хватать нужных API
        const importMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*'\.\.\/services\/api'/);
        if (importMatch) {
            const existing = importMatch[1].split(',').map(s => s.trim());
            const needed = config.apis.filter(a => !existing.includes(a));
            if (needed.length > 0) {
                const allApis = [...existing, ...needed].join(', ');
                content = content.replace(importMatch[0], `import { ${allApis} } from '../services/api'`);
            }
        }
    }

    // Заменить fetch вызовы
    // Пока не делаем замену, т.к. fetch-паттерн более сложный (await, then, headers)
    // Только добавляем импорт — замену сделаем потом вручную где нужно

    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`OK: ${fileName} — импорт добавлен: ${config.apis.join(', ')}`);
    updated++;
}

console.log(`\n=== Результат ===`);
console.log(`✅ Обновлено: ${updated}`);
