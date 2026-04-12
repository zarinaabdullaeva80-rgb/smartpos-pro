// Скрипт очистки: переместить утилитарные скрипты из server/ в server/scripts/utils/
// И переместить .md документацию из корня в docs/
const fs = require('fs');
const path = require('path');

const serverDir = path.join(__dirname, '..', 'server');
const utilsDir = path.join(serverDir, 'scripts', 'utils');
const rootDir = path.join(__dirname, '..');
const docsDir = path.join(rootDir, 'docs');

// 1) Перемещение утилитарных скриптов сервера
if (!fs.existsSync(utilsDir)) {
    fs.mkdirSync(utilsDir, { recursive: true });
}

const utilPatterns = /^(check|fix|test|create|reset|migrate|add|assign|run|quick|cleanup|apply|complete)/;
const serverFiles = fs.readdirSync(serverDir).filter(f => {
    const ext = path.extname(f);
    return (ext === '.js' || ext === '.cjs' || ext === '.mjs') && utilPatterns.test(f);
});

let movedServer = 0;
for (const f of serverFiles) {
    const src = path.join(serverDir, f);
    const dest = path.join(utilsDir, f);
    try {
        fs.copyFileSync(src, dest);
        fs.unlinkSync(src);
        movedServer++;
    } catch (e) {
        console.log(`ERR: ${f}: ${e.message}`);
    }
}
console.log(`✅ Перемещено ${movedServer} утилитарных скриптов → server/scripts/utils/`);

// 2) Перемещение document .md из корня в docs/
if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
}

const keepInRoot = ['README.md', 'CHANGELOG.md'];
const mdFiles = fs.readdirSync(rootDir).filter(f => {
    return path.extname(f) === '.md' && !keepInRoot.includes(f) && !f.startsWith('.');
});

let movedDocs = 0;
for (const f of mdFiles) {
    const src = path.join(rootDir, f);
    const dest = path.join(docsDir, f);
    try {
        // Проверяем что это файл, не директория
        if (fs.statSync(src).isFile()) {
            fs.copyFileSync(src, dest);
            fs.unlinkSync(src);
            movedDocs++;
        }
    } catch (e) {
        console.log(`ERR: ${f}: ${e.message}`);
    }
}
console.log(`✅ Перемещено ${movedDocs} .md файлов → docs/`);

// 3) Удалить .backup файлы в server/
const backupFiles = fs.readdirSync(serverDir).filter(f => f.endsWith('.backup'));
let removedBackups = 0;
for (const f of backupFiles) {
    try {
        fs.unlinkSync(path.join(serverDir, f));
        removedBackups++;
    } catch (e) { }
}
console.log(`✅ Удалено ${removedBackups} .backup файлов`);

console.log('\n=== Очистка завершена ===');
