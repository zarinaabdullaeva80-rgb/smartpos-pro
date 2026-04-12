const fs = require('fs');
const path = require('path');

const SMARTPOS = 'C:/Users/user/Desktop/SmartPOS';

function fixFile(filePath, replacements) {
    if (!fs.existsSync(filePath)) {
        console.log(`  SKIP: ${path.basename(filePath)} not found`);
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
    } else {
        console.log(`  OK: ${path.basename(filePath)} (no changes needed)`);
    }
}

console.log('=== SmartPOS Pro Branding Fix ===\n');

// 1. Fix LoginScreen.js
console.log('1. LoginScreen.js:');
fixFile(`${SMARTPOS}/src/screens/LoginScreen.js`, [
    ['1С Мобильная касса', 'SmartPOS Pro'],
    ['Мобильная касса', 'Мобильный POS'],
    ['Версия 2.0.0', 'Версия 2.3.0'],
    ['Версия 1.0.0', 'Версия 2.3.0'],
]);

// 2. Fix SettingsScreen.js 
console.log('\n2. SettingsScreen.js:');
fixFile(`${SMARTPOS}/src/screens/SettingsScreen.js`, [
    ['1С Мобильная касса', 'SmartPOS Pro'],
    ['Мобильная касса', 'Мобильный POS'],
    ['Версия 2.0.0', 'Версия 2.3.0'],
    ['Версия 1.0.0', 'Версия 2.3.0'],
]);

// 3. Fix app.json
console.log('\n3. app.json:');
const appJsonPath = `${SMARTPOS}/app.json`;
if (fs.existsSync(appJsonPath)) {
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
    const changes = [];
    if (appJson.expo.name !== 'SmartPOS Pro') {
        changes.push(`  name: "${appJson.expo.name}" -> "SmartPOS Pro"`);
        appJson.expo.name = 'SmartPOS Pro';
    }
    if (appJson.expo.slug !== 'smartpos-pro') {
        changes.push(`  slug: "${appJson.expo.slug}" -> "smartpos-pro"`);
        appJson.expo.slug = 'smartpos-pro';
    }
    if (appJson.expo.version !== '2.3.0') {
        changes.push(`  version: "${appJson.expo.version}" -> "2.3.0"`);
        appJson.expo.version = '2.3.0';
    }
    if (changes.length > 0) {
        fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n', 'utf8');
        changes.forEach(c => console.log(c));
        console.log('  SAVED: app.json');
    } else {
        console.log('  OK: app.json (no changes needed)');
    }
}

// 4. Search ALL JS files for any remaining "1С" references
console.log('\n4. Scanning all JS files for remaining "1С" references...');
function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    const items = fs.readdirSync(dir);
    for (const item of items) {
        if (item === 'node_modules' || item === '.expo' || item === 'android' || item === 'ios') continue;
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            scanDir(fullPath);
        } else if (item.endsWith('.js') || item.endsWith('.json')) {
            try {
                const content = fs.readFileSync(fullPath, 'utf8');
                if (content.includes('1С') && !fullPath.includes('node_modules')) {
                    const lines = content.split('\n');
                    lines.forEach((line, i) => {
                        if (line.includes('1С')) {
                            console.log(`  ${path.relative(SMARTPOS, fullPath)}:${i + 1}: ${line.trim().substring(0, 80)}`);
                        }
                    });
                }
            } catch (e) { }
        }
    }
}
scanDir(SMARTPOS);

console.log('\n=== DONE ===');
