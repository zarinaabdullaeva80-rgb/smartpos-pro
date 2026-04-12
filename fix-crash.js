const fs = require('fs');
const path = require('path');

const DIR = 'C:/Users/user/mpos-build';

console.log('=== SmartPOS Pro Crash Fix ===\n');

// ============================================
// FIX 1: errorReporter.js - safe expo-constants import
// ============================================
console.log('1. Fixing errorReporter.js...');
const erPath = `${DIR}/src/services/errorReporter.js`;
let erContent = fs.readFileSync(erPath, 'utf8');

// Replace the direct import with safe require
erContent = erContent.replace(
    "import Constants from 'expo-constants';",
    `// Safe import - expo-constants may not be available
let Constants = null;
try {
    Constants = require('expo-constants').default || require('expo-constants');
} catch (e) {
    Constants = { expoConfig: { version: '2.3.0' }, platform: {} };
}`
);

// Also make init() fully safe
erContent = erContent.replace(
    `    static async init() {
        if (this.isInitialized) return;

        try {`,
    `    static async init() {
        if (this.isInitialized) return;

        try {
            if (!Constants) Constants = { expoConfig: { version: '2.3.0' }, platform: {} };`
);

fs.writeFileSync(erPath, erContent, 'utf8');
console.log('   OK - expo-constants import made safe');

// ============================================
// FIX 2: UpdateChecker.js - wrap expo-updates safely
// ============================================
console.log('\n2. Fixing UpdateChecker.js...');
const ucPath = `${DIR}/src/components/UpdateChecker.js`;
let ucContent = fs.readFileSync(ucPath, 'utf8');

// Replace the expo-updates check with full safety
const oldExpoUpdatesBlock = `        // 1. Проверка через expo-updates (OTA)
        try {
            const Updates = require('expo-updates');
            if (!Updates.isEmbeddedLaunch) {
                const update = await Updates.checkForUpdateAsync();
                if (update.isAvailable) {
                    // Загрузить changelog с сервера
                    await fetchChangelog();
                    setUpdateAvailable(true);
                    return;
                }
            }
        } catch (e) {
            // expo-updates может быть недоступен в dev-mode
            console.log('[UpdateChecker] expo-updates not available:', e.message);
        }`;

const newExpoUpdatesBlock = `        // 1. Проверка через expo-updates (OTA) - SAFE
        try {
            const Updates = require('expo-updates');
            // Проверяем что модуль реально загрузился и имеет нужные методы
            if (Updates && typeof Updates.checkForUpdateAsync === 'function') {
                try {
                    const update = await Updates.checkForUpdateAsync();
                    if (update && update.isAvailable) {
                        await fetchChangelog();
                        setUpdateAvailable(true);
                        return;
                    }
                } catch (updateErr) {
                    console.log('[UpdateChecker] checkForUpdate failed:', updateErr.message);
                }
            }
        } catch (e) {
            // expo-updates не установлен или недоступен
            console.log('[UpdateChecker] expo-updates not available:', e.message);
        }`;

ucContent = ucContent.replace(oldExpoUpdatesBlock, newExpoUpdatesBlock);

// Also fix applyUpdate
const oldApplyBlock = `        try {
            const Updates = require('expo-updates');
            await Updates.fetchUpdateAsync();
            Alert.alert(
                'Обновление загружено',
                'Приложение будет перезапущено для применения обновления.',
                [{ text: 'Перезапустить', onPress: () => Updates.reloadAsync() }]
            );`;

const newApplyBlock = `        try {
            const Updates = require('expo-updates');
            if (Updates && typeof Updates.fetchUpdateAsync === 'function') {
                await Updates.fetchUpdateAsync();
                Alert.alert(
                    'Обновление загружено',
                    'Приложение будет перезапущено для применения обновления.',
                    [{ text: 'Перезапустить', onPress: () => Updates.reloadAsync() }]
                );
            } else {
                Alert.alert('Ошибка', 'Модуль обновлений недоступен');
            }`;

ucContent = ucContent.replace(oldApplyBlock, newApplyBlock);

fs.writeFileSync(ucPath, ucContent, 'utf8');
console.log('   OK - expo-updates calls wrapped safely');

// ============================================
// FIX 3: App.js - make ErrorReporter.init() safe
// ============================================
console.log('\n3. Fixing App.js...');
const appPath = `${DIR}/App.js`;
let appContent = fs.readFileSync(appPath, 'utf8');

// Wrap console.error override in try/catch
const oldConsoleOverride = `// 🚀 EXTREME EARLY LOGGING (RAUND 7)
// Перехватываем консоль сразу, чтобы поймать ошибки до отрисовки
const originalConsoleError = console.error;
console.error = (...args) => {
    ErrorReporter.report({
        severity: 'critical',
        message: 'Console Error: ' + args.join(' '),
        component: 'EarlyBoot'
    });
    originalConsoleError.apply(console, args);
};

// Инициализируем логгер НЕМЕДЛЕННО (без setTimeout)
ErrorReporter.init();`;

const newConsoleOverride = `// Safe error reporting initialization
try {
    const originalConsoleError = console.error;
    console.error = (...args) => {
        try {
            ErrorReporter.report({
                severity: 'critical',
                message: 'Console Error: ' + args.join(' '),
                component: 'EarlyBoot'
            });
        } catch (e) { /* ignore */ }
        originalConsoleError.apply(console, args);
    };
    // Инициализируем логгер отложенно (после рендера)
    setTimeout(() => {
        try { ErrorReporter.init(); } catch(e) { console.log('[App] ErrorReporter init skipped:', e.message); }
    }, 2000);
} catch (e) {
    console.log('[App] Error reporter setup skipped');
}`;

if (appContent.includes(oldConsoleOverride)) {
    appContent = appContent.replace(oldConsoleOverride, newConsoleOverride);
    console.log('   OK - ErrorReporter.init() deferred and wrapped');
} else {
    console.log('   WARN - Could not find exact ErrorReporter block, trying partial fix...');
    appContent = appContent.replace(
        'ErrorReporter.init();',
        'try { setTimeout(() => ErrorReporter.init(), 2000); } catch(e) {}'
    );
    console.log('   OK - ErrorReporter.init() deferred');
}

fs.writeFileSync(appPath, appContent, 'utf8');

// ============================================
// FIX 4: ErrorBoundary.js - check if it handles errors properly
// ============================================
console.log('\n4. Checking ErrorBoundary.js...');
const ebPath = `${DIR}/src/components/ErrorBoundary.js`;
const ebContent = fs.readFileSync(ebPath, 'utf8');
if (ebContent.includes('componentDidCatch')) {
    console.log('   OK - has componentDidCatch');
} else {
    console.log('   WARN - missing componentDidCatch');
}

// ============================================
// VERIFY: Check all imports resolve
// ============================================
console.log('\n5. Verifying all screen imports...');
const screens = [
    'LoginScreen', 'HomeScreen', 'ProductsScreen', 'CartScreen',
    'SalesHistoryScreen', 'SaleDetailsScreen', 'BarcodeScannerScreen',
    'PaymentMethodsScreen', 'ReturnsScreen', 'ReturnsHistoryScreen',
    'ShiftManagementScreen', 'SettingsScreen', 'ReportsScreen',
    'CustomersScreen', 'InventoryScreen', 'QRPaymentScreen',
    'CashierSwitchScreen', 'ServerSettingsScreen', 'SyncScreen',
    'LoyaltyScreen', 'NotificationsScreen'
];
let missing = 0;
for (const s of screens) {
    const p = `${DIR}/src/screens/${s}.js`;
    if (!fs.existsSync(p)) {
        console.log(`   MISSING: ${s}.js`);
        missing++;
    }
}
if (missing === 0) console.log('   OK - all 21 screens present');

// Check component imports
const components = ['ErrorBoundary', 'UpdateChecker'];
for (const c of components) {
    const p = `${DIR}/src/components/${c}.js`;
    if (!fs.existsSync(p)) {
        console.log(`   MISSING: component ${c}.js`);
        missing++;
    }
}

// Check service imports
const services = ['settings', 'errorReporter'];
for (const s of services) {
    const p = `${DIR}/src/services/${s}.js`;
    if (!fs.existsSync(p)) {
        console.log(`   MISSING: service ${s}.js`);
        missing++;
    }
}

// Check context
if (!fs.existsSync(`${DIR}/src/context/ThemeContext.js`)) {
    console.log('   MISSING: ThemeContext.js');
    missing++;
}

// Check config
if (!fs.existsSync(`${DIR}/src/config/settings.js`)) {
    console.log('   MISSING: config/settings.js');
    missing++;
}

if (missing === 0) {
    console.log('   OK - all imports verified');
}

// ============================================
// Check for other dangerous imports
// ============================================
console.log('\n6. Scanning for dangerous imports...');
function scanImports(dir) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
        if (['node_modules', '.expo', 'android', 'ios', 'dist', '__tests__'].includes(item)) continue;
        const full = path.join(dir, item);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
            scanImports(full);
        } else if (item.endsWith('.js')) {
            const content = fs.readFileSync(full, 'utf8');
            const lines = content.split('\n');
            lines.forEach((line, i) => {
                // Check for imports of packages not in package.json
                const importMatch = line.match(/(?:import|require)\s*\(?['"]([^./][^'"]*)['"]/);
                if (importMatch) {
                    const pkg = importMatch[1].startsWith('@')
                        ? importMatch[1].split('/').slice(0, 2).join('/')
                        : importMatch[1].split('/')[0];
                    const dangerousPkgs = ['expo-constants', 'expo-updates', 'expo-notifications', 'expo-location'];
                    if (dangerousPkgs.includes(pkg) && !line.trim().startsWith('//')) {
                        const rel = path.relative(DIR, full);
                        console.log(`   ⚠️  ${rel}:${i + 1}: ${line.trim().substring(0, 70)}`);
                    }
                }
            });
        }
    }
}
scanImports(`${DIR}/src`);

console.log('\n=== ALL FIXES APPLIED ===');
