const fs = require('fs');
const path = require('path');

const PAGES_DIR = 'C:/Users/user/Desktop/1С бухгалтерия/client-accounting/src/pages';
console.log('=== Find all async/await issues ===\n');

const files = [];
function scan(dir) {
    for (const item of fs.readdirSync(dir)) {
        const full = path.join(dir, item);
        const stat = fs.statSync(full);
        if (stat.isDirectory() && !['node_modules', 'dist'].includes(item)) scan(full);
        else if (item.endsWith('.jsx') || item.endsWith('.js')) files.push(full);
    }
}
scan('C:/Users/user/Desktop/1С бухгалтерия/client-accounting/src');

let issues = 0;
for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    // Track function context
    let inAsyncFn = false;
    let braceDepth = 0;
    let asyncDepth = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Skip comments
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

        // Simple check: find "await" on lines where the containing function is not async
        // Look backwards from await to find the containing function declaration
        if (line.includes('await ') || line.includes('await(')) {
            // Check if this await is inside an async function
            // Look backwards for the nearest function declaration
            let foundAsync = false;
            let depth = 0;
            for (let j = i; j >= 0; j--) {
                const prevLine = lines[j];
                // Count braces to track scope
                for (const ch of prevLine) {
                    if (ch === '}') depth++;
                    if (ch === '{') depth--;
                }

                // If we've exited the current scope, check if the function is async
                if (depth <= 0) {
                    if (prevLine.includes('async ') || prevLine.includes('async(')) {
                        foundAsync = true;
                        break;
                    }
                    // Found a non-async function/arrow containing this code
                    if ((prevLine.includes('=> {') || prevLine.includes('function ') || prevLine.includes('function(')) && !prevLine.includes('async')) {
                        if (depth < 0) break; // We're at the function declaration level
                    }
                }
            }

            if (!foundAsync) {
                const rel = path.relative('C:/Users/user/Desktop/1С бухгалтерия/client-accounting/src', file);
                console.log(`❌ ${rel}:${i + 1}: ${trimmed.substring(0, 80)}`);
                issues++;
            }
        }
    }
}

if (issues === 0) {
    console.log('✅ No async/await issues found!');
} else {
    console.log(`\nFound ${issues} potential issues`);
}

// Also check for other common build errors
console.log('\n=== Other build issues ===');
for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const rel = path.relative('C:/Users/user/Desktop/1С бухгалтерия/client-accounting/src', file);

    // Double carriage returns 
    if (content.includes('\r\r')) {
        console.log(`⚠️  ${rel}: Double \\r\\r detected`);
    }

    // Missing closing tags or braces
    const opens = (content.match(/{/g) || []).length;
    const closes = (content.match(/}/g) || []).length;
    if (opens !== closes) {
        console.log(`⚠️  ${rel}: Mismatched braces { ${opens} vs } ${closes}`);
    }
}
console.log('\nDone!');
