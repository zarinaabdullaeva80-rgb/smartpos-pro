const fs = require('fs');
const path = require('path');

const SRC_DIR = 'C:/Users/user/Desktop/1С бухгалтерия/client-accounting/src';
console.log('=== Auto-fix: await without async ===\n');

const files = [];
function scan(dir) {
    for (const item of fs.readdirSync(dir)) {
        const full = path.join(dir, item);
        const stat = fs.statSync(full);
        if (stat.isDirectory() && !['node_modules', 'dist', '__tests__'].includes(item)) scan(full);
        else if (item.endsWith('.jsx') || item.endsWith('.js')) files.push(full);
    }
}
scan(SRC_DIR);

let totalFixed = 0;

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    let lines = content.split('\n');
    let modified = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check if line uses 'await' (not in comments)
        if (!line.includes('await ') && !line.includes('await(')) continue;
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;

        // Walk backwards to find the containing function declaration
        let braceCount = 0;
        for (let j = i; j >= 0; j--) {
            const prevLine = lines[j];

            // Count braces on this line
            for (let k = prevLine.length - 1; k >= 0; k--) {
                if (prevLine[k] === '}') braceCount++;
                if (prevLine[k] === '{') braceCount--;
            }

            // When braceCount goes negative, we found the opening brace of our containing function
            if (braceCount < 0) {
                // Check if this line (or the line before) declares a non-async function
                const funcLine = prevLine;
                const prevPrevLine = j > 0 ? lines[j - 1] : '';

                // Match: const xxx = () => {  OR  const xxx = (args) => {  OR  function xxx() {
                const arrowMatch = funcLine.match(/^(\s*const\s+\w+\s*=\s*)\(([^)]*)\)\s*=>\s*\{/) ||
                    funcLine.match(/^(\s*const\s+\w+\s*=\s*)\(\)\s*=>\s*\{/);
                const funcMatch = funcLine.match(/^(\s*)(function\s+\w+\s*\([^)]*\)\s*\{)/);

                if (arrowMatch && !funcLine.includes('async')) {
                    // Add async: const xxx = () => {  →  const xxx = async () => {
                    lines[j] = funcLine.replace(/(\s*const\s+\w+\s*=\s*)(\()/, '$1async $2');
                    const rel = path.relative(SRC_DIR, file);
                    console.log(`✅ Fixed ${rel}:${j + 1}: ${lines[j].trim().substring(0, 70)}`);
                    modified = true;
                    totalFixed++;
                    break;
                }

                if (funcMatch && !funcLine.includes('async')) {
                    lines[j] = funcLine.replace(/function\s+/, 'async function ');
                    const rel = path.relative(SRC_DIR, file);
                    console.log(`✅ Fixed ${rel}:${j + 1}: ${lines[j].trim().substring(0, 70)}`);
                    modified = true;
                    totalFixed++;
                    break;
                }

                break; // Found function declaration, exit inner loop
            }
        }
    }

    if (modified) {
        fs.writeFileSync(file, lines.join('\n'), 'utf8');
    }
}

console.log(`\n=== Fixed ${totalFixed} functions ===`);
