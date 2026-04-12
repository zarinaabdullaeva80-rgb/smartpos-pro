const fs = require('fs');
const path = require('path');

const DIR = 'C:/Users/user/mpos-build';

console.log('=== DEEP CRASH ANALYSIS ===\n');

// 1. Get all packages from package.json
const pkg = JSON.parse(fs.readFileSync(`${DIR}/package.json`, 'utf8'));
const installedPkgs = {
    ...pkg.dependencies,
    ...pkg.devDependencies
};
console.log('Installed packages:', Object.keys(installedPkgs).length);

// 2. Check which packages actually exist in node_modules
console.log('\n--- Package.json vs node_modules ---');
for (const [name, ver] of Object.entries(installedPkgs)) {
    const nmPath = path.join(DIR, 'node_modules', name);
    const exists = fs.existsSync(nmPath);
    if (!exists) {
        console.log(`  ❌ MISSING in node_modules: ${name}@${ver}`);
    }
}

// 3. Scan ALL imports in src/
console.log('\n--- All external imports used in src/ ---');
const usedPkgs = new Set();
const importsByFile = {};

function scanFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const rel = path.relative(DIR, filePath);

    lines.forEach((line, i) => {
        // Match import ... from 'package' and require('package')
        const matches = [
            ...line.matchAll(/import\s+.*?from\s+['"]([^./][^'"]*)['"]/g),
            ...line.matchAll(/require\s*\(\s*['"]([^./][^'"]*)['"]\s*\)/g),
        ];

        for (const match of matches) {
            if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;

            const fullPkg = match[1];
            const pkg = fullPkg.startsWith('@')
                ? fullPkg.split('/').slice(0, 2).join('/')
                : fullPkg.split('/')[0];

            usedPkgs.add(pkg);

            if (!importsByFile[pkg]) importsByFile[pkg] = [];
            importsByFile[pkg].push({ file: rel, line: i + 1, code: line.trim().substring(0, 80) });
        }
    });
}

function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    const items = fs.readdirSync(dir);
    for (const item of items) {
        if (['node_modules', '.expo', 'android', 'ios', 'dist', '__tests__'].includes(item)) continue;
        const full = path.join(dir, item);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
            scanDir(full);
        } else if (item.endsWith('.js') || item.endsWith('.jsx')) {
            scanFile(full);
        }
    }
}

// Scan App.js + src/
scanFile(`${DIR}/App.js`);
if (fs.existsSync(`${DIR}/index.js`)) scanFile(`${DIR}/index.js`);
scanDir(`${DIR}/src`);

// 4. Find packages used but NOT in package.json
console.log('\n--- ⚠️  Used but NOT in package.json ---');
const missing = [];
for (const pkg of usedPkgs) {
    if (!installedPkgs[pkg]) {
        // Check if it exists in node_modules (transitive dep)
        const nmPath = path.join(DIR, 'node_modules', pkg);
        const inNM = fs.existsSync(nmPath);
        const status = inNM ? '(exists in node_modules as transitive)' : '❌ NOT INSTALLED';
        console.log(`  ${pkg} ${status}`);
        if (importsByFile[pkg]) {
            importsByFile[pkg].forEach(ref => {
                console.log(`    └─ ${ref.file}:${ref.line}: ${ref.code}`);
            });
        }
        if (!inNM) missing.push(pkg);
    }
}

if (missing.length === 0) {
    console.log('  All used packages are available!');
}

// 5. Check for react-native-paper boolean issue
console.log('\n--- Checking for boolean/string cast issues ---');
function checkBooleanIssues(dir) {
    if (!fs.existsSync(dir)) return;
    const items = fs.readdirSync(dir);
    for (const item of items) {
        if (['node_modules', '.expo', 'android', 'ios'].includes(item)) continue;
        const full = path.join(dir, item);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
            checkBooleanIssues(full);
        } else if (item.endsWith('.js')) {
            const content = fs.readFileSync(full, 'utf8');
            const lines = content.split('\n');
            lines.forEach((line, i) => {
                // Check for boolean props passed as strings
                if (line.match(/(?:visible|disabled|loading|secureTextEntry|autoCorrect|autoCapitalize)=["'](true|false)["']/)) {
                    console.log(`  ⚠️  ${path.relative(DIR, full)}:${i + 1}: ${line.trim().substring(0, 80)}`);
                }
            });
        }
    }
}
checkBooleanIssues(DIR);

// 6. Check contexts vs context directory conflict
console.log('\n--- Directory structure check ---');
const srcDirs = fs.readdirSync(`${DIR}/src`);
console.log('src/ subdirs:', srcDirs.join(', '));
if (srcDirs.includes('context') && srcDirs.includes('contexts')) {
    console.log('  ⚠️  Both context/ AND contexts/ exist! Potential conflict.');
    console.log('  context/:', fs.readdirSync(`${DIR}/src/context`).join(', '));
    console.log('  contexts/:', fs.readdirSync(`${DIR}/src/contexts`).join(', '));
}

// 7. Check if expo-dev-launcher / expo-dev-client cause issues
console.log('\n--- Checking for dev-only packages in build ---');
const devPkgs = ['expo-dev-launcher', 'expo-dev-client', 'expo-dev-menu'];
for (const dp of devPkgs) {
    const inPkg = !!installedPkgs[dp];
    const inNM = fs.existsSync(path.join(DIR, 'node_modules', dp));
    if (inPkg || inNM) {
        console.log(`  ⚠️  ${dp}: pkg.json=${inPkg}, node_modules=${inNM}`);
    }
}

// 8. Check android/app/build.gradle for issues
console.log('\n--- Checking android build config ---');
const appGradle = fs.readFileSync(`${DIR}/android/app/build.gradle`, 'utf8');
if (appGradle.includes('enableHermes')) {
    const hermesMatch = appGradle.match(/enableHermes:\s*(true|false)/);
    console.log(`  Hermes: ${hermesMatch ? hermesMatch[1] : 'configured'}`);
} else {
    console.log('  Hermes: not explicitly configured (default)');
}

// Check for proguard
if (appGradle.includes('minifyEnabled true') || appGradle.includes('shrinkResources true')) {
    console.log('  ⚠️  ProGuard/R8 enabled - may strip needed classes');
}

console.log('\n=== ANALYSIS COMPLETE ===');
