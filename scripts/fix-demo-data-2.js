// Скрипт 2: обработка оставшихся файлов с нестандартными паттернами
// 1) Файлы без импорта API -> добавить импорт
// 2) Файлы с MANUAL -> универсальный парсер

const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, '..', 'client-accounting', 'src', 'pages');

// Маппинг файлов к API модулям
const fileApiMap = {
    'ABCXYZAnalysis.jsx': 'analyticsAPI',
    'AccountingEntries.jsx': 'financeAPI',
    'Achievements.jsx': 'loyaltyAPI',
    'AuditLog.jsx': 'auditAPI',
    'BalanceSheet.jsx': 'financeAPI',
    'BOMRecipes.jsx': 'productsAPI',
    'CohortAnalysis.jsx': 'analyticsAPI',
    'Contracts.jsx': 'contractsAPI',
    'CostCalculation.jsx': 'financeAPI',
    'Currencies.jsx': 'financeAPI',
    'DashboardSettings.jsx': 'settingsAPI',
    'DeliveryZones.jsx': 'deliveriesAPI',
    'EmailCampaigns.jsx': 'crmAPI',
    'EmployeeKPI.jsx': 'employeesAPI',
    'Equipment.jsx': 'settingsAPI',
    'ExpiryTracking.jsx': 'productsAPI',
    'GiftCertificates.jsx': 'loyaltyAPI',
    'GoogleSheetsSettings.jsx': 'settingsAPI',
    'GPSTracking.jsx': 'deliveriesAPI',
    'Implementation.jsx': 'sync1CAPI',
    'ImportExport.jsx': 'settingsAPI',
    'Installments.jsx': 'financeAPI',
    'Marketplaces.jsx': 'settingsAPI',
    'OrderTracking.jsx': 'salesAPI',
    'Payables.jsx': 'financeAPI',
    'Payroll.jsx': 'employeesAPI',
    'Permissions.jsx': 'permissionsAPI',
    'PermissionsManagement.jsx': 'permissionsAPI',
    'Preorders.jsx': 'salesAPI',
    'PriceHistory.jsx': 'productsAPI',
    'ProductBundles.jsx': 'productsAPI',
    'ProductLabels.jsx': 'productsAPI',
    'ProfitLoss.jsx': 'financeAPI',
    'Promotions.jsx': 'loyaltyAPI',
    'QuickActions.jsx': 'settingsAPI',
    'ReceiptSettings.jsx': 'settingsAPI',
    'Receivables.jsx': 'financeAPI',
    'ReferralProgram.jsx': 'loyaltyAPI',
    'RFMAnalysis.jsx': 'analyticsAPI',
    'ScheduledTasks.jsx': 'schedulerAPI',
    'SerialNumbers.jsx': 'productsAPI',
    'SMSCampaigns.jsx': 'crmAPI',
    'StaffManagement.jsx': 'employeesAPI',
    'SupplierRatings.jsx': 'counterpartiesAPI',
    'Sync1CSettings.jsx': 'sync1CAPI',
    'TelegramSettings.jsx': 'telegramAPI',
    'Testing.jsx': 'settingsAPI',
    'TimeTracking.jsx': 'employeesAPI',
    'TrainingVideos.jsx': 'settingsAPI',
    'Updates.jsx': 'updatesAPI',
    'WarehouseMap.jsx': 'wmsAPI',
    'Waybills.jsx': 'deliveriesAPI',
    'Wishlists.jsx': 'customersAPI',
    'WorkSchedule.jsx': 'employeesAPI',
    'MultiCurrency.jsx': 'financeAPI',
    'SalesPipeline.jsx': 'crmAPI'
};

let updated = 0;
let skipped = 0;
let errors = [];

for (const [file, apiModule] of Object.entries(fileApiMap)) {
    const filePath = path.join(pagesDir, file);
    if (!fs.existsSync(filePath)) {
        console.log(`SKIP: ${file} — не найден`);
        skipped++;
        continue;
    }

    let content = fs.readFileSync(filePath, 'utf-8');

    // 1) Добавить импорт API, если его нет
    const hasApiImport = content.includes("from '../services/api'");
    if (!hasApiImport) {
        // Добавить после последнего import
        const lastImportIdx = content.lastIndexOf('\nimport ');
        if (lastImportIdx >= 0) {
            const lineEnd = content.indexOf('\n', lastImportIdx + 1);
            content = content.substring(0, lineEnd + 1) +
                `import { ${apiModule} } from '../services/api';\n` +
                content.substring(lineEnd + 1);
        } else {
            content = `import { ${apiModule} } from '../services/api';\n` + content;
        }
    } else {
        // Проверить, есть ли нужный модуль в импорте
        const importMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]\.\.\/services\/api['"]/);
        if (importMatch && !importMatch[1].includes(apiModule)) {
            const oldImport = importMatch[0];
            const newImport = oldImport.replace('{', `{ ${apiModule}, `).replace(', }', ' }');
            content = content.replace(oldImport, newImport);
        }
    }

    // 2) Найти loadData / loadXxx функцию
    const loadFuncMatch = content.match(/const\s+(load\w+)\s*=\s*(async\s*)?\(([^)]*)\)\s*=>\s*\{/);
    if (!loadFuncMatch) {
        // Нет loadData - просто сохраняем с импортом
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`IMPORT: ${file} -> ${apiModule} (loadData не найден)`);
        updated++;
        continue;
    }

    const funcName = loadFuncMatch[1];
    const isAsync = !!loadFuncMatch[2];
    const funcStart = content.indexOf(loadFuncMatch[0]);

    // Найти конец функции
    let depth = 0, funcEnd = funcStart, started = false;
    for (let i = funcStart; i < content.length; i++) {
        if (content[i] === '{') { depth++; started = true; }
        else if (content[i] === '}') { depth--; }
        if (started && depth === 0) { funcEnd = i + 1; break; }
    }

    const funcBody = content.substring(funcStart, funcEnd);

    // Найти все set* вызовы (не setLoading)
    const setterRegex = /\b(set(?!Loading)\w+)\s*\(/g;
    const setterNames = new Set();
    let m;
    while ((m = setterRegex.exec(funcBody)) !== null) {
        setterNames.add(m[1]);
    }

    if (setterNames.size === 0) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`IMPORT: ${file} -> ${apiModule} (нет setters)`);
        updated++;
        continue;
    }

    // Определяем, уже ли есть try-catch с API
    const hasApiCall = funcBody.includes('await ') && funcBody.includes('API.');
    const hasTryCatch = funcBody.includes('try {') || funcBody.includes('try{');

    if (hasApiCall && hasTryCatch) {
        // Уже обработан, но нужно проверить, используется ли apiData в setState
        if (funcBody.includes('apiData.') || funcBody.includes('apiRes.data')) {
            // Уже использует API-данные
            fs.writeFileSync(filePath, content, 'utf-8');
            console.log(`ALREADY: ${file} (уже использует API-данные)`);
            updated++;
            continue;
        }
    }

    // Извлечь каждый setter и его значение из функции
    const extractSetterValues = (body) => {
        const results = [];
        const pattern = /(set(?!Loading)\w+)\s*\(/g;
        let match;
        while ((match = pattern.exec(body)) !== null) {
            const setter = match[1];
            const startPos = match.index + match[0].length;
            let d = 1;
            let i = startPos;
            for (; i < body.length && d > 0; i++) {
                if (body[i] === '(' || body[i] === '[' || body[i] === '{') d++;
                else if (body[i] === ')' || body[i] === ']' || body[i] === '}') d--;
            }
            const value = body.substring(startPos, i - 1).trim();
            results.push({ setter, value });
        }
        return results;
    };

    const setterValues = extractSetterValues(funcBody);

    if (setterValues.length === 0) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`IMPORT: ${file} -> ${apiModule} (setters пустые)`);
        updated++;
        continue;
    }

    // Генерируем новый loadData
    const getApiField = (setter) => {
        const name = setter.replace(/^set/, '');
        return name.charAt(0).toLowerCase() + name.slice(1);
    };

    const hasParams = loadFuncMatch[3] && loadFuncMatch[3].trim();
    const paramStr = hasParams ? loadFuncMatch[3] : '';

    let newFunc = `const ${funcName} = async (${paramStr}) => {\n`;
    newFunc += `        try {\n`;
    newFunc += `            const apiRes = await ${apiModule}.getAll();\n`;
    newFunc += `            const apiData = apiRes.data || apiRes;\n`;

    for (const sv of setterValues) {
        const field = getApiField(sv.setter);
        const isArrayOrObj = sv.value.startsWith('[') || sv.value.startsWith('{');
        if (isArrayOrObj) {
            newFunc += `            ${sv.setter}(apiData.${field} || ${sv.value});\n`;
        } else {
            newFunc += `            ${sv.setter}(${sv.value});\n`;
        }
    }

    newFunc += `        } catch (err) {\n`;
    newFunc += `            console.warn('${file}: API недоступен, используем локальные данные');\n`;

    for (const sv of setterValues) {
        newFunc += `            ${sv.setter}(${sv.value});\n`;
    }

    newFunc += `        }\n`;
    newFunc += `        setLoading(false);\n`;
    newFunc += `    }`;

    content = content.replace(funcBody, newFunc);

    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`OK: ${file} -> ${apiModule}, ${setterValues.length} setters`);
    updated++;
}

console.log(`\n=== Результат ===`);
console.log(`✅ Обновлено: ${updated}`);
console.log(`⏭️ Пропущено: ${skipped}`);
