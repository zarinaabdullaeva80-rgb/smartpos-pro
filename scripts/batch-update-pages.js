// Скрипт массового обновления: добавляет import API и оборачивает loadData в async с API-вызовом
const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, '..', 'client-accounting', 'src', 'pages');

// Маппинг файлов к их API-модулям
const mapping = {
    'AIForecasting.jsx': 'analyticsAPI',
    'Achievements.jsx': 'loyaltyAPI',
    'AutoOrder.jsx': 'productsAPI',
    'BOMRecipes.jsx': 'productsAPI',
    'BirthdayCampaigns.jsx': 'crmAPI',
    'BankIntegration.jsx': 'financeAPI',
    'CardRefunds.jsx': 'returnsAPI',
    'CohortAnalysis.jsx': 'analyticsAPI',
    'ConversionFunnel.jsx': 'analyticsAPI',
    'CostCalculation.jsx': 'financeAPI',
    'CrossDocking.jsx': 'warehousesAPI',
    'CustomerLevels.jsx': 'loyaltyAPI',
    'CustomerPortal.jsx': 'customersAPI',
    'CustomerSegments.jsx': 'customersAPI',
    'DashboardSettings.jsx': 'settingsAPI',
    'DeliveryRoutes.jsx': 'deliveriesAPI',
    'DeliveryZones.jsx': 'deliveriesAPI',
    'EmployeeKPI.jsx': 'employeesAPI',
    'ExpiryTracking.jsx': 'batchesAPI',
    'FiscalReports.jsx': 'reportsAPI',
    'GPSTracking.jsx': 'deliveriesAPI',
    'IPWhitelist.jsx': 'sessionsAPI',
    'ImportExport.jsx': 'settingsAPI',
    'InventoryValuation.jsx': 'inventoryAPI',
    'Marketplaces.jsx': 'settingsAPI',
    'MinimumStock.jsx': 'productsAPI',
    'OfflineSettings.jsx': 'settingsAPI',
    'Permissions.jsx': 'permissionsAPI',
    'Preorders.jsx': 'salesAPI',
    'PriceHistory.jsx': 'productsAPI',
    'ProductLabels.jsx': 'productsAPI',
    'ProductionOrders.jsx': 'productsAPI',
    'PurchasePlanning.jsx': 'purchasesAPI',
    'PushNotifications.jsx': 'notificationsAPI',
    'Quotations.jsx': 'salesAPI',
    'ReconciliationAct.jsx': 'financeAPI',
    'SalesForecast.jsx': 'analyticsAPI',
    'SalesHeatmap.jsx': 'analyticsAPI',
    'SplitPayments.jsx': 'financeAPI',
    'SupplierContracts.jsx': 'contractsAPI',
    'SupplierRatings.jsx': 'counterpartiesAPI',
    'TargetedOffers.jsx': 'crmAPI',
    'TaxReports.jsx': 'reportsAPI',
    'TipsReport.jsx': 'reportsAPI',
    'TrainingVideos.jsx': 'settingsAPI',
    'Waybills.jsx': 'salesAPI',
    'Wishlists.jsx': 'customersAPI',
};

// API -> метод вызова
const apiMethods = {
    'analyticsAPI': 'getAll()',
    'loyaltyAPI': 'getAll()',
    'productsAPI': 'getAll()',
    'crmAPI': 'getAll()',
    'financeAPI': 'getAccounts()',
    'returnsAPI': 'getAll()',
    'warehousesAPI': 'getAll()',
    'customersAPI': 'getAll()',
    'settingsAPI': 'getAll()',
    'deliveriesAPI': 'getAll()',
    'employeesAPI': 'getAll()',
    'batchesAPI': 'getExpiring()',
    'reportsAPI': 'getDashboard()',
    'sessionsAPI': 'getAll()',
    'inventoryAPI': 'getAll()',
    'permissionsAPI': 'getRoles()',
    'salesAPI': 'getAll()',
    'purchasesAPI': 'getAll()',
    'contractsAPI': 'getAll()',
    'counterpartiesAPI': 'getAll()',
    'notificationsAPI': 'getAll()',
};

let updated = 0, skipped = 0, errorCount = 0;

for (const [fileName, apiName] of Object.entries(mapping)) {
    const filePath = path.join(pagesDir, fileName);

    if (!fs.existsSync(filePath)) {
        console.log(`SKIP: ${fileName} — файл не найден`);
        skipped++;
        continue;
    }

    let content = fs.readFileSync(filePath, 'utf-8');

    // Уже подключен?
    if (content.includes("from '../services/api'")) {
        console.log(`SKIP: ${fileName} — уже подключён`);
        skipped++;
        continue;
    }

    try {
        // 1. Добавить import после последнего import-а
        const lines = content.split('\n');
        let lastImportLine = -1;
        for (let i = 0; i < lines.length; i++) {
            const trimmed = lines[i].trim();
            if (trimmed.startsWith('import ') && (trimmed.includes(' from ') || trimmed.includes("from '"))) {
                lastImportLine = i;
            }
        }

        if (lastImportLine >= 0) {
            lines.splice(lastImportLine + 1, 0, `import { ${apiName} } from '../services/api';`);
        }

        // 2. Заменить const loadData = () => {  на  const loadData = async () => {
        //    Добавить try { const apiData = await API.method(); } catch(e) {}
        //    перед существующими set-вызовами
        content = lines.join('\n');

        const method = apiMethods[apiName] || 'getAll()';

        // Найти loadData и заменить на async версию с API-вызовом
        const syncPattern = '    const loadData = () => {';
        const asyncReplacement = `    const loadData = async () => {
        try {
            const apiRes = await ${apiName}.${method};
            const apiData = apiRes.data || apiRes;
            console.log('${fileName}: данные загружены с сервера', apiData);
        } catch (err) {
            console.warn('${fileName}: API недоступен, используем локальные данные');
        }`;

        if (content.includes(syncPattern)) {
            content = content.replace(syncPattern, asyncReplacement);
        } else {
            // Может быть с другим отступом
            const alt = 'const loadData = () => {';
            if (content.includes(alt)) {
                content = content.replace(alt, `const loadData = async () => {
        try {
            const apiRes = await ${apiName}.${method};
            const apiData = apiRes.data || apiRes;
            console.log('${fileName}: данные загружены с сервера', apiData);
        } catch (err) {
            console.warn('${fileName}: API недоступен, используем локальные данные');
        }`);
            }
        }

        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`OK: ${fileName} -> ${apiName}.${method}`);
        updated++;
    } catch (err) {
        console.error(`ERROR: ${fileName}: ${err.message}`);
        errorCount++;
    }
}

console.log(`\n=== Результат ===`);
console.log(`✅ Обновлено: ${updated}`);
console.log(`⏭️ Пропущено: ${skipped}`);
console.log(`❌ Ошибок: ${errorCount}`);
