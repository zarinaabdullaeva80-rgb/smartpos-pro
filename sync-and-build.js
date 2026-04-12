const fs = require('fs');
const path = require('path');

const SRC = 'C:/Users/user/mpos-build';
const DST = 'C:/Users/user/Desktop/SmartPOS';

function copyDirRecursive(src, dst) {
    if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
    const items = fs.readdirSync(src);
    let copied = 0;
    for (const item of items) {
        if (['node_modules', '.expo', 'android', 'ios', 'dist', '.git', 'build-log', 'build-output', 'build_log', 'build_output', 'full_logcat.txt', 'mobile_logs.txt', 'gradle-build.log'].some(x => item.startsWith(x))) continue;
        if (item.endsWith('.apk')) continue;
        const srcPath = path.join(src, item);
        const dstPath = path.join(dst, item);
        const stat = fs.statSync(srcPath);
        if (stat.isDirectory()) {
            copied += copyDirRecursive(srcPath, dstPath);
        } else {
            fs.copyFileSync(srcPath, dstPath);
            copied++;
        }
    }
    return copied;
}

console.log('=== Copying mpos-build -> SmartPOS ===\n');

// 1. Copy src/ directory (all screens, services, config, context)
console.log('1. Copying src/...');
const srcCopied = copyDirRecursive(path.join(SRC, 'src'), path.join(DST, 'src'));
console.log(`   Copied ${srcCopied} files from src/`);

// 2. Copy App.js
console.log('2. Copying App.js...');
fs.copyFileSync(path.join(SRC, 'App.js'), path.join(DST, 'App.js'));
console.log('   OK');

// 3. Copy app.json
console.log('3. Copying app.json...');
fs.copyFileSync(path.join(SRC, 'app.json'), path.join(DST, 'app.json'));
console.log('   OK');

// 4. Copy other config files
const configFiles = ['babel.config.js', 'metro.config.js', 'index.js', 'eas.json'];
console.log('4. Copying config files...');
for (const f of configFiles) {
    const srcF = path.join(SRC, f);
    if (fs.existsSync(srcF)) {
        fs.copyFileSync(srcF, path.join(DST, f));
        console.log(`   ${f} OK`);
    }
}

// 5. Copy assets
console.log('5. Copying assets/...');
const assetsCopied = copyDirRecursive(path.join(SRC, 'assets'), path.join(DST, 'assets'));
console.log(`   Copied ${assetsCopied} files from assets/`);

// 6. Now fix ALL branding in the copied files
console.log('\n6. Fixing branding...');

function fixFile(filePath, replacements) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;
    for (const [from, to] of replacements) {
        if (content.includes(from)) {
            content = content.replaceAll(from, to);
            changed = true;
        }
    }
    if (changed) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`   Fixed: ${path.basename(filePath)}`);
    }
}

// Fix app.json
const appJsonPath = path.join(DST, 'app.json');
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
appJson.expo.name = 'SmartPOS Pro';
appJson.expo.slug = 'smartpos-pro';
appJson.expo.version = '2.3.0';
fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n', 'utf8');
console.log('   Fixed: app.json');

// Fix App.js
fixFile(path.join(DST, 'App.js'), [
    ["title: '1С Продажа'", "title: 'SmartPOS Pro'"],
]);

// Fix screens
fixFile(path.join(DST, 'src/screens/LoginScreen.js'), [
    ['Мобильная касса', 'Мобильный POS'],
]);

fixFile(path.join(DST, 'src/screens/SettingsScreen.js'), [
    ['1С Мобильная касса', 'SmartPOS Pro'],
    ['Версия 2.0.0', 'Версия 2.3.0'],
]);

fixFile(path.join(DST, 'src/screens/HomeScreen.js'), [
    ['Обмен данными с 1С', 'Синхронизация данных'],
]);

fixFile(path.join(DST, 'src/screens/SyncScreen.js'), [
    ['Синхронизация с 1С', 'Синхронизация данных'],
]);

fixFile(path.join(DST, 'src/services/electronicReceipt.js'), [
    ['1С ПРОДАЖА', 'SMARTPOS PRO'],
    ['1С Продажа', 'SmartPOS Pro'],
]);

fixFile(path.join(DST, 'src/services/printer.js'), [
    ["'1С МАГАЗИН'", "'SMARTPOS PRO'"],
]);

fixFile(path.join(DST, 'src/services/sync1c.js'), [
    ['Импорт товаров из 1С...', 'Импорт товаров...'],
    ['Экспорт продаж в 1С...', 'Экспорт продаж...'],
]);

// 7. Delete old backup files
console.log('\n7. Cleaning up old files...');
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
let deleted = 0;
for (const f of oldFiles) {
    const full = path.join(DST, f);
    if (fs.existsSync(full)) { fs.unlinkSync(full); deleted++; }
}
console.log(`   Deleted ${deleted} old files`);

console.log('\n=== DONE! Ready to rebuild APK ===');
console.log('Run: cd SmartPOS\\android && gradlew.bat clean assembleRelease --no-daemon');
