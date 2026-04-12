const fs = require('fs');
const path = require('path');

const DIR = 'C:/Users/user/mpos-build';
const pkg = JSON.parse(fs.readFileSync(DIR + '/package.json', 'utf8'));
const deps = new Set(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }));

function getImports(file) {
    if (!fs.existsSync(file)) return [];
    const c = fs.readFileSync(file, 'utf8');
    const results = [];
    const lines = c.split('\n');
    lines.forEach((l, i) => {
        if (l.trim().startsWith('//') || l.trim().startsWith('*')) return;

        // Match: import ... from 'package'
        const importMatch = l.match(/import\s+.*?from\s+['"]([^'"]+)['"]/);
        if (importMatch) results.push({ pkg: importMatch[1], line: i + 1, code: l.trim().substring(0, 80) });

        // Match: require('package')
        const requireMatch = l.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
        if (requireMatch) results.push({ pkg: requireMatch[1], line: i + 1, code: l.trim().substring(0, 80) });
    });
    return results;
}

console.log('=== Import Chain Analysis from App.js ===\n');

const visited = new Set();
const missingPkgs = new Map();
const missingFiles = [];

function resolveLocal(fromFile, importPath) {
    const dir = path.dirname(fromFile);
    let resolved = path.resolve(dir, importPath);

    if (fs.existsSync(resolved + '.js')) return resolved + '.js';
    if (fs.existsSync(resolved + '.jsx')) return resolved + '.jsx';
    if (fs.existsSync(resolved + '/index.js')) return resolved + '/index.js';
    if (fs.existsSync(resolved)) {
        const stat = fs.statSync(resolved);
        if (stat.isDirectory()) {
            if (fs.existsSync(resolved + '/index.js')) return resolved + '/index.js';
        }
        return resolved;
    }
    return null;
}

function trace(filePath, depth) {
    const absPath = path.isAbsolute(filePath) ? filePath : path.resolve(DIR, filePath);
    if (visited.has(absPath)) return;
    visited.add(absPath);

    const imports = getImports(absPath);

    for (const imp of imports) {
        if (imp.pkg.startsWith('.')) {
            // Local import
            const resolved = resolveLocal(absPath, imp.pkg);
            if (!resolved) {
                missingFiles.push({
                    from: path.relative(DIR, absPath),
                    import: imp.pkg,
                    line: imp.line
                });
            } else {
                trace(resolved, depth + 1);
            }
        } else {
            // External package
            const pkgName = imp.pkg.startsWith('@')
                ? imp.pkg.split('/').slice(0, 2).join('/')
                : imp.pkg.split('/')[0];

            if (!deps.has(pkgName)) {
                const inNodeModules = fs.existsSync(path.join(DIR, 'node_modules', pkgName));
                if (!inNodeModules) {
                    if (!missingPkgs.has(pkgName)) missingPkgs.set(pkgName, []);
                    missingPkgs.get(pkgName).push({
                        file: path.relative(DIR, absPath),
                        line: imp.line,
                        code: imp.code
                    });
                }
            }
        }
    }
}

// Start tracing from entry points
trace(path.resolve(DIR, 'App.js'), 0);

console.log(`Traced ${visited.size} files reachable from App.js\n`);

// Report missing packages
console.log('--- Missing packages (NOT in node_modules) ---');
if (missingPkgs.size === 0) {
    console.log('  None! All external imports resolved.\n');
} else {
    missingPkgs.forEach((refs, pkg) => {
        console.log(`  ❌ ${pkg}:`);
        refs.forEach(r => console.log(`    ${r.file}:${r.line}: ${r.code}`));
    });
    console.log();
}

// Report missing local files
console.log('--- Missing local files ---');
if (missingFiles.length === 0) {
    console.log('  None! All local imports resolved.\n');
} else {
    missingFiles.forEach(f => {
        console.log(`  ❌ ${f.from}:${f.line} imports "${f.import}" — NOT FOUND`);
    });
    console.log();
}

// List all traced files
console.log('--- Files in bundle (reachable from App.js) ---');
const sortedFiles = [...visited].map(f => path.relative(DIR, f)).sort();
sortedFiles.forEach(f => console.log('  ' + f));

console.log('\n=== DONE ===');
