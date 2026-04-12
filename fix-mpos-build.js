const fs = require('fs');
const path = require('path');

const DIR = 'C:/Users/user/mpos-build';

function fixFile(filePath, replacements) {
    if (!fs.existsSync(filePath)) { console.log(`  SKIP: ${filePath}`); return; }
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;
    for (const [from, to] of replacements) {
        if (content.includes(from)) {
            content = content.replaceAll(from, to);
            console.log(`  "${from}" -> "${to}"`);
            changed = true;
        }
    }
    if (changed) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`  SAVED: ${path.basename(filePath)}`);
    } else {
        console.log(`  OK: ${path.basename(filePath)}`);
    }
}

console.log('=== Fix branding in mpos-build ===\n');

// 1. app.json
console.log('1. app.json:');
const appJson = JSON.parse(fs.readFileSync(`${DIR}/app.json`, 'utf8'));
console.log(`  Before: name="${appJson.expo.name}" slug="${appJson.expo.slug}" ver="${appJson.expo.version}"`);
appJson.expo.name = 'SmartPOS Pro';
appJson.expo.slug = 'smartpos-pro';
appJson.expo.version = '2.3.0';
if (!appJson.expo.updates) appJson.expo.updates = {};
appJson.expo.updates.enabled = false;
fs.writeFileSync(`${DIR}/app.json`, JSON.stringify(appJson, null, 2) + '\n', 'utf8');
console.log(`  After: name="${appJson.expo.name}" slug="${appJson.expo.slug}" ver="${appJson.expo.version}"`);

// 2. App.js
console.log('\n2. App.js:');
fixFile(`${DIR}/App.js`, [
    ["title: '1С Продажа'", "title: 'SmartPOS Pro'"],
]);

// 3. LoginScreen
console.log('\n3. LoginScreen.js:');
fixFile(`${DIR}/src/screens/LoginScreen.js`, [
    ['1С Мобильная касса', 'SmartPOS Pro'],
    ['Мобильная касса', 'Мобильный POS'],
]);

// 4. SettingsScreen
console.log('\n4. SettingsScreen.js:');
fixFile(`${DIR}/src/screens/SettingsScreen.js`, [
    ['1С Мобильная касса', 'SmartPOS Pro'],
    ['Версия 2.0.0', 'Версия 2.3.0'],
]);

// 5. Other files
console.log('\n5. Other files:');
fixFile(`${DIR}/src/screens/HomeScreen.js`, [['Обмен данными с 1С', 'Синхронизация данных']]);
fixFile(`${DIR}/src/screens/SyncScreen.js`, [['Синхронизация с 1С', 'Синхронизация данных']]);
fixFile(`${DIR}/src/services/electronicReceipt.js`, [['1С ПРОДАЖА', 'SMARTPOS PRO'], ['1С Продажа', 'SmartPOS Pro']]);
fixFile(`${DIR}/src/services/printer.js`, [["'1С МАГАЗИН'", "'SMARTPOS PRO'"]]);
fixFile(`${DIR}/src/services/sync1c.js`, [['Импорт товаров из 1С...', 'Импорт товаров...'], ['Экспорт продаж в 1С...', 'Экспорт продаж...']]);

// 6. local.properties
console.log('\n6. local.properties:');
const localProps = `${DIR}/android/local.properties`;
fs.writeFileSync(localProps, 'sdk.dir=C:\\\\Users\\\\user\\\\AppData\\\\Local\\\\Android\\\\Sdk\n', 'utf8');
console.log('  Created');

// 7. Check AGP version
console.log('\n7. build.gradle AGP check:');
const buildGradle = fs.readFileSync(`${DIR}/android/build.gradle`, 'utf8');
if (buildGradle.includes("classpath('com.android.tools.build:gradle')") && !buildGradle.includes("classpath('com.android.tools.build:gradle:")) {
    console.log('  WARNING: AGP has no version pinned!');
    const fixed = buildGradle.replace(
        "classpath('com.android.tools.build:gradle')",
        "classpath('com.android.tools.build:gradle:8.3.0')"
    );
    fs.writeFileSync(`${DIR}/android/build.gradle`, fixed, 'utf8');
    console.log('  FIXED: Pinned AGP to 8.3.0');
} else if (buildGradle.includes("classpath('com.android.tools.build:gradle:")) {
    const match = buildGradle.match(/classpath\('com\.android\.tools\.build:gradle:([\d.]+)'\)/);
    console.log(`  OK: AGP ${match ? match[1] : 'found'}`);
} else {
    console.log('  OK: AGP managed by plugins block');
}

// 8. Delete old backup files
console.log('\n8. Cleanup:');
const oldFiles = [
    'App-backup-broken.js', 'App-backup.js', 'App-current-broken.js',
    'App-full.js', 'App-minimal.js', 'App-test-chip.js',
    'App-test-minimal.js', 'App-test-working.js',
];
let del = 0;
for (const f of oldFiles) {
    const p = path.join(DIR, f);
    if (fs.existsSync(p)) { fs.unlinkSync(p); del++; }
}
console.log(`  Deleted ${del} old files`);

console.log('\n=== READY! Run gradle build from mpos-build/android ===');
