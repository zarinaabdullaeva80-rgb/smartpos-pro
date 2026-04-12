/**
 * Скрипт для массовой замены alert() на useToast() в JSX файлах
 * Запуск: node scripts/replace-alerts.js
 */
const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, '..', 'src', 'pages');

// Файлы, которые уже используют useToast или были обработаны вручную
const SKIP_FILES = [
    'PermissionsManagement.jsx', // уже заменены на setMessage
    'SalesPipeline.jsx',         // уже заменены на setStatusMsg
];

function processFile(filePath) {
    const basename = path.basename(filePath);
    if (SKIP_FILES.includes(basename)) {
        console.log(`SKIP: ${basename} (уже обработан)`);
        return { file: basename, status: 'skipped' };
    }

    let content = fs.readFileSync(filePath, 'utf-8');

    // Проверяем наличие alert()
    const alertRegex = /\balert\s*\(/g;
    const matches = content.match(alertRegex);
    if (!matches) {
        return { file: basename, status: 'no-alerts' };
    }

    const alertCount = matches.length;

    // Проверяем, уже ли импортирован useToast
    const hasUseToast = content.includes('useToast');

    // Определяем, есть ли функциональный компонент
    const funcCompMatch = content.match(/(?:function|const)\s+(\w+)\s*(?:=\s*\(?\s*\)?\s*=>|=\s*function|\()/);

    if (!hasUseToast) {
        // Добавляем импорт useToast
        if (content.includes("from '../components/ToastProvider'")) {
            // Уже есть импорт из ToastProvider, добавляем useToast
            content = content.replace(
                /from\s+'\.\.\/components\/ToastProvider'/,
                match => match  // Уже содержит
            );
        } else {
            // Добавляем новый импорт после первого import
            const firstImportEnd = content.indexOf('\n', content.indexOf('import '));
            if (firstImportEnd > -1) {
                // Ищем последний import
                let lastImportIdx = -1;
                let searchIdx = 0;
                while (true) {
                    const nextImport = content.indexOf('\nimport ', searchIdx);
                    if (nextImport === -1) break;
                    lastImportIdx = nextImport;
                    searchIdx = nextImport + 1;
                }
                if (lastImportIdx === -1) lastImportIdx = 0;
                const endOfLastImport = content.indexOf('\n', lastImportIdx + 1);
                const importLine = "\nimport { useToast } from '../components/ToastProvider';";
                content = content.slice(0, endOfLastImport) + importLine + content.slice(endOfLastImport);
            }
        }

        // Добавляем const toast = useToast(); после открытия компонента
        // Ищем паттерн: function ComponentName() { или const ComponentName = () => {
        const patterns = [
            // function ComponentName() {\n
            /(?:export\s+default\s+)?function\s+\w+\s*\([^)]*\)\s*\{/,
            // const ComponentName = () => {\n
            /const\s+\w+\s*=\s*\([^)]*\)\s*=>\s*\{/,
            // const ComponentName = function() {\n  
            /const\s+\w+\s*=\s*function\s*\([^)]*\)\s*\{/,
        ];

        let inserted = false;
        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match) {
                const insertPos = content.indexOf(match[0]) + match[0].length;
                const nextLine = content.indexOf('\n', insertPos);
                if (nextLine > -1) {
                    // Проверяем, нет ли уже toast
                    const nextLines = content.slice(insertPos, insertPos + 200);
                    if (!nextLines.includes('useToast()')) {
                        content = content.slice(0, nextLine + 1) +
                            '    const toast = useToast();\n' +
                            content.slice(nextLine + 1);
                        inserted = true;
                    }
                }
                break;
            }
        }

        if (!inserted) {
            console.log(`  WARNING: Не удалось вставить useToast() в ${basename}`);
        }
    }

    // Заменяем alert() на toast вызовы
    // Определяем тип по содержимому сообщения
    content = content.replace(/\balert\s*\(\s*(['"`])(.*?)\1\s*\)/g, (match, quote, msg) => {
        const lowerMsg = msg.toLowerCase();
        let method = 'info';

        if (lowerMsg.includes('ошибк') || lowerMsg.includes('error') || lowerMsg.includes('неверн') ||
            lowerMsg.includes('не удалось') || lowerMsg.includes('нельзя') || lowerMsg.includes('невозможно') ||
            lowerMsg.includes('failed') || lowerMsg.includes('не найден')) {
            method = 'error';
        } else if (lowerMsg.includes('успеш') || lowerMsg.includes('сохран') || lowerMsg.includes('удален') ||
            lowerMsg.includes('создан') || lowerMsg.includes('добавлен') || lowerMsg.includes('обновлен') ||
            lowerMsg.includes('отправлен') || lowerMsg.includes('выполнен') || lowerMsg.includes('готов') ||
            lowerMsg.includes('success')) {
            method = 'success';
        } else if (lowerMsg.includes('вниман') || lowerMsg.includes('предупрежд') || lowerMsg.includes('warning') ||
            lowerMsg.includes('осторожн')) {
            method = 'warning';
        }

        return `toast.${method}(${quote}${msg}${quote})`;
    });

    // Также заменяем alert() с переменными/шаблонными строками
    content = content.replace(/\balert\s*\(\s*(`[^`]*`)\s*\)/g, (match, templateStr) => {
        return `toast.info(${templateStr})`;
    });

    // Заменяем alert() с конкатенацией строк
    content = content.replace(/\balert\s*\(\s*([^)]+)\s*\)/g, (match, expr) => {
        // Пропускаем если уже заменен на toast
        if (expr.includes('toast.')) return match;
        // Пропускаем если это не строковое выражение
        if (expr.includes('=>') || expr.includes('function')) return match;
        return `toast.info(${expr})`;
    });

    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`OK: ${basename} (${alertCount} alert → toast)`);
    return { file: basename, status: 'replaced', count: alertCount };
}

// Обработка всех JSX файлов
const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.jsx'));
console.log(`\nНайдено ${files.length} JSX файлов в pages/\n`);

const results = [];
for (const file of files) {
    const result = processFile(path.join(pagesDir, file));
    results.push(result);
}

// Обработка компонентов
const componentsDir = path.join(__dirname, '..', 'src', 'components');
if (fs.existsSync(componentsDir)) {
    const compFiles = fs.readdirSync(componentsDir).filter(f => f.endsWith('.jsx'));
    for (const file of compFiles) {
        const result = processFile(path.join(componentsDir, file));
        results.push(result);
    }
}

// Обработка utils
const utilsDir = path.join(__dirname, '..', 'src', 'utils');
if (fs.existsSync(utilsDir)) {
    const utilFiles = fs.readdirSync(utilsDir).filter(f => f.endsWith('.js') || f.endsWith('.jsx'));
    for (const file of utilFiles) {
        // utils не являются React-компонентами, пропускаем
        console.log(`SKIP: utils/${file} (не React-компонент)`);
    }
}

console.log('\n--- Итог ---');
const replaced = results.filter(r => r.status === 'replaced');
const skipped = results.filter(r => r.status === 'skipped');
const noAlerts = results.filter(r => r.status === 'no-alerts');
console.log(`Заменено: ${replaced.length} файлов (${replaced.reduce((s, r) => s + (r.count || 0), 0)} alert вызовов)`);
console.log(`Пропущено: ${skipped.length} файлов`);
console.log(`Без alert: ${noAlerts.length} файлов`);
