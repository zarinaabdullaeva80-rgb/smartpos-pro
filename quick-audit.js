const fs = require('fs');
const path = require('path');

const PAGES_DIR = 'C:/Users/user/Desktop/1С бухгалтерия/client-accounting/src/pages';
const API_FILE = 'C:/Users/user/Desktop/1С бухгалтерия/client-accounting/src/services/api.js';

console.log('=== Client-Accounting Quick Audit ===\n');

const apiContent = fs.readFileSync(API_FILE, 'utf8');
const pages = fs.readdirSync(PAGES_DIR).filter(f => f.endsWith('.jsx'));
console.log(`Total pages: ${pages.length}\n`);

const issues = [];

for (const page of pages) {
    const filePath = path.join(PAGES_DIR, page);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const pageIssues = [];

    // 1. Check for undefined data/mockData references
    if (content.includes('(data)') || content.includes('(mockData)')) {
        // Check if data is properly declared
        const hasDataDecl = content.includes('const data ') || content.includes('let data ') ||
            content.includes('const { data') || content.includes('.data') ||
            content.includes('= data') || content.includes('apiRes');
        if (!hasDataDecl && content.match(/set\w+\(data\)/)) {
            pageIssues.push('🔴 Dead `data` reference (not declared)');
        }
    }

    // 2. Check for missing API imports
    const apiImports = content.match(/import\s+{([^}]+)}\s+from\s+['"]\.\.\/services\/api['"]/);
    if (apiImports) {
        const imported = apiImports[1].split(',').map(s => s.trim());
        for (const imp of imported) {
            if (imp && !apiContent.includes(`export const ${imp}`) && !apiContent.includes(`export { ${imp}`) && !apiContent.includes(`${imp} =`)) {
                pageIssues.push(`🔴 Missing API: ${imp} not exported from api.js`);
            }
        }
    }

    // 3. Check for TODO/FIXME
    lines.forEach((line, i) => {
        if (line.includes('TODO') || line.includes('FIXME') || line.includes('HACK')) {
            pageIssues.push(`🟡 ${line.trim().substring(0, 60)} (line ${i + 1})`);
        }
    });

    // 4. Check for console.error without try/catch (potential unhandled)
    const hasLoadData = content.includes('loadData');
    const hasTryCatch = content.includes('try {') || content.includes('try{');
    if (hasLoadData && !hasTryCatch) {
        pageIssues.push('🟡 loadData() without try/catch');
    }

    // 5. Check for empty components
    if (content.length < 500) {
        pageIssues.push('🟡 Very small file - possibly stub/placeholder');
    }

    // 6. Check for hardcoded localhost
    if (content.includes('localhost:5000') && !['Login.jsx'].includes(page)) {
        pageIssues.push('🟡 Hardcoded localhost:5000');
    }

    // 7. Check for window.alert
    if (content.includes('window.alert') || content.match(/\balert\(/)) {
        if (!content.includes('Alert') && !content.includes('useToast')) {
            pageIssues.push('🟡 Uses alert() instead of toast');
        }
    }

    if (pageIssues.length > 0) {
        issues.push({ page, issues: pageIssues });
    }
}

// Print results
if (issues.length === 0) {
    console.log('✅ No issues found in any page!');
} else {
    console.log(`Found issues in ${issues.length} pages:\n`);
    // Sort by severity (red first)
    issues.sort((a, b) => {
        const aHasRed = a.issues.some(i => i.startsWith('🔴'));
        const bHasRed = b.issues.some(i => i.startsWith('🔴'));
        return bHasRed - aHasRed;
    });

    for (const { page, issues: pageIssues } of issues) {
        console.log(`📄 ${page}:`);
        for (const issue of pageIssues) {
            console.log(`   ${issue}`);
        }
        console.log();
    }
}

// Check for pages without useToast or useConfirm
console.log('\n--- Pages without toast/confirm ---');
let noToast = 0;
for (const page of pages) {
    const content = fs.readFileSync(path.join(PAGES_DIR, page), 'utf8');
    if (!content.includes('useToast') && !content.includes('useConfirm') && content.length > 2000) {
        // console.log(`  ${page}`);
        noToast++;
    }
}
console.log(`  ${noToast} pages without useToast/useConfirm (some may not need it)\n`);

console.log('=== DONE ===');
