const fs = require('fs');
const path = require('path');

const SMARTPOS = 'C:/Users/user/Desktop/SmartPOS';

function fixFile(filePath, replacements) {
    if (!fs.existsSync(filePath)) {
        console.log(`  SKIP: ${filePath}`);
        return;
    }
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;
    for (const [from, to] of replacements) {
        if (content.includes(from)) {
            content = content.replaceAll(from, to);
            console.log(`  FIXED: "${from}" -> "${to}"`);
            changed = true;
        }
    }
    if (changed) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`  SAVED: ${path.basename(filePath)}`);
    }
}

console.log('=== SmartPOS Pro - Fix Remaining 1С Refs ===\n');

// App.js - main navigation title
fixFile(`${SMARTPOS}/App.js`, [
    ["title: '1С Продажа'", "title: 'SmartPOS Pro'"],
]);

// HomeScreen - sync description
fixFile(`${SMARTPOS}/src/screens/HomeScreen.js`, [
    ['Обмен данными с 1С', 'Синхронизация данных'],
]);

// SyncScreen
fixFile(`${SMARTPOS}/src/screens/SyncScreen.js`, [
    ['Синхронизация с 1С', 'Синхронизация данных'],
]);

// Electronic Receipt
fixFile(`${SMARTPOS}/src/services/electronicReceipt.js`, [
    ['1С ПРОДАЖА', 'SMARTPOS PRO'],
    ['1С Продажа', 'SmartPOS Pro'],
]);

// Printer
fixFile(`${SMARTPOS}/src/services/printer.js`, [
    ["'1С МАГАЗИН'", "'SMARTPOS PRO'"],
]);

// sync1c.js - comments only, keep service name
fixFile(`${SMARTPOS}/src/services/sync1c.js`, [
    ['Импорт товаров из 1С...', 'Импорт товаров...'],
    ['Экспорт продаж в 1С...', 'Экспорт продаж...'],
]);

// Delete old backup LoginScreen files
const oldFiles = [
    'App-backup-broken.js', 'App-backup.js', 'App-current-broken.js',
    'App-full.js', 'App-minimal.js', 'App-test-chip.js',
    'App-test-minimal.js', 'App-test-working.js',
    'src/screens/LoginScreen-fixed.js', 'src/screens/LoginScreen-original.js',
    'src/screens/LoginScreen-step1.js', 'src/screens/LoginScreen-step2.js',
    'src/screens/LoginScreen-step3.js', 'src/screens/LoginScreen-step4.js',
    'src/screens/LoginScreen-step5.js', 'src/screens/LoginScreen-step6.js',
    'src/screens/LoginScreen-step7.js', 'src/screens/HomeScreenMinimal.js',
    'src/screens/HomeScreenSimple.js',
];

console.log('\nDeleting old backup files...');
let deleted = 0;
for (const f of oldFiles) {
    const full = path.join(SMARTPOS, f);
    if (fs.existsSync(full)) {
        fs.unlinkSync(full);
        deleted++;
    }
}
console.log(`Deleted ${deleted} old files.`);

// Verify
console.log('\n=== Verification: remaining "1С" in UI files ===');
const checkFiles = ['App.js', 'src/screens/LoginScreen.js', 'src/screens/SettingsScreen.js', 'src/screens/HomeScreen.js'];
for (const f of checkFiles) {
    const full = path.join(SMARTPOS, f);
    if (fs.existsSync(full)) {
        const content = fs.readFileSync(full, 'utf8');
        const lines = content.split('\n');
        let found = false;
        lines.forEach((line, i) => {
            if (line.includes('1С') && !line.trim().startsWith('//') && !line.trim().startsWith('*')) {
                console.log(`  WARNING: ${f}:${i + 1}: ${line.trim().substring(0, 80)}`);
                found = true;
            }
        });
        if (!found) console.log(`  OK: ${f}`);
    }
}

console.log('\n=== ALL DONE ===');
