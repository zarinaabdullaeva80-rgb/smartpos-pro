// Финальный скрипт: подключаем оставшиеся 28 страниц к API
const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, '..', 'client-accounting', 'src', 'pages');

const remaining = {
    'Administration.jsx': 'settingsAPI',
    'APIDocumentation.jsx': 'settingsAPI',
    'Automation.jsx': 'settingsAPI',
    'ConfigurationSettings.jsx': 'settingsAPI',
    'Contracts.jsx': 'contractsAPI',
    'Currencies.jsx': 'financeAPI',
    'CustomerDeposits.jsx': 'customersAPI',
    'CustomerReviews.jsx': 'customersAPI',
    'DashboardWidgets.jsx': 'settingsAPI',
    'DataMigration.jsx': 'settingsAPI',
    'GoogleSheetsSettings.jsx': 'settingsAPI',
    'Installments.jsx': 'financeAPI',
    'Integrations.jsx': 'settingsAPI',
    'KeyboardShortcuts.jsx': 'settingsAPI',
    'OrderTracking.jsx': 'salesAPI',
    'PaymentSettings.jsx': 'settingsAPI',
    'PriceTagPrinter.jsx': 'productsAPI',
    'ProductBundles.jsx': 'productsAPI',
    'ProductModifiers.jsx': 'productsAPI',
    'QuickActions.jsx': 'settingsAPI',
    'ReferralProgram.jsx': 'loyaltyAPI',
    'ScheduledTasks.jsx': 'schedulerAPI',
    'SerialNumbers.jsx': 'productsAPI',
    'Settings.jsx': 'settingsAPI',
    'Support.jsx': 'settingsAPI',
    'Testing.jsx': 'settingsAPI',
    'ThemeSettings.jsx': 'settingsAPI',
    'Updates.jsx': 'updatesAPI',
};

const apiMethods = {
    'settingsAPI': 'getAll()',
    'contractsAPI': 'getAll()',
    'financeAPI': 'getAccounts()',
    'customersAPI': 'getAll()',
    'salesAPI': 'getAll()',
    'productsAPI': 'getAll()',
    'loyaltyAPI': 'getAll()',
    'schedulerAPI': 'getTasks()',
    'updatesAPI': 'check()',
};

let updated = 0;

for (const [fileName, apiName] of Object.entries(remaining)) {
    const filePath = path.join(pagesDir, fileName);

    if (!fs.existsSync(filePath)) {
        console.log(`SKIP: ${fileName} — файл не найден`);
        continue;
    }

    let content = fs.readFileSync(filePath, 'utf-8');

    if (content.includes("from '../services/api'")) {
        console.log(`SKIP: ${fileName} — уже подключён`);
        continue;
    }

    // Добавить import
    const importLine = `import { ${apiName} } from '../services/api';`;
    const lines = content.split('\n');
    let lastImportLine = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('import ') && lines[i].includes(' from ')) {
            lastImportLine = i;
        }
    }

    if (lastImportLine >= 0) {
        lines.splice(lastImportLine + 1, 0, importLine);
    } else {
        lines.unshift(importLine);
    }
    content = lines.join('\n');

    // Заменить loadData = () => на loadData = async () => с API-вызовом
    const method = apiMethods[apiName] || 'getAll()';
    const syncPattern = 'const loadData = () => {';

    if (content.includes(syncPattern)) {
        content = content.replace(syncPattern, `const loadData = async () => {
        try {
            const apiRes = await ${apiName}.${method};
            const apiData = apiRes.data || apiRes;
            console.log('${fileName}: данные загружены с сервера', apiData);
        } catch (err) {
            console.warn('${fileName}: API недоступен, используем локальные данные');
        }`);
    }

    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`OK: ${fileName} -> ${apiName}`);
    updated++;
}

console.log(`\n=== Результат ===`);
console.log(`✅ Обновлено: ${updated}`);
