// Скрипт: заменить прямые import в App.jsx на React.lazy
// import ComponentName from './pages/ComponentName';
// -> const ComponentName = React.lazy(() => import('./pages/ComponentName'));

const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'client-accounting', 'src', 'App.jsx');
let content = fs.readFileSync(appPath, 'utf-8');

// Не переводить в lazy: Login, Layout, Dashboard (критичны для первой загрузки)
const keepDirect = ['Login', 'Layout', 'Dashboard', 'ErrorBoundary', 'ToastProvider', 'LoadingSpinner'];

// Найти все import из ./pages/ или ./components/
const importRegex = /^import\s+(\w+)\s+from\s+['"](\.\/(pages|components)\/\w+)['"]\s*;?\s*$/gm;

let count = 0;
const lazyImports = [];
const removedImports = [];

let match;
while ((match = importRegex.exec(content)) !== null) {
    const name = match[1];
    const importPath = match[2];

    if (keepDirect.includes(name)) continue;

    // Только pages — components оставляем прямыми
    if (!importPath.startsWith('./pages/')) continue;

    lazyImports.push(`const ${name} = React.lazy(() => import('${importPath}'));`);
    removedImports.push(match[0]);
    count++;
}

// Удалить старые импорты
for (const oldImport of removedImports) {
    content = content.replace(oldImport + '\r\n', '');
    content = content.replace(oldImport + '\n', '');
}

// Добавить lazy imports после последнего прямого import
const lastImportIdx = content.lastIndexOf('\nimport ');
const nextLineIdx = content.indexOf('\n', lastImportIdx + 1);

const lazyBlock = '\n// Lazy-loaded pages (code-splitting)\n' + lazyImports.join('\n') + '\n';
content = content.substring(0, nextLineIdx + 1) + lazyBlock + content.substring(nextLineIdx + 1);

fs.writeFileSync(appPath, content, 'utf-8');
console.log(`✅ Заменено ${count} импортов на React.lazy`);
console.log('Оставлены прямые импорты для:', keepDirect.join(', '));
