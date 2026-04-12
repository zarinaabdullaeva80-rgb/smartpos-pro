// Скрипт: замена демо-данных на реальные API-ответы в loadData
// Обрабатывает два паттерна:
// Паттерн A (async с неиспользуемым API): try { apiRes = await API.method(); } catch {} setData([демо]);
//   -> Результат: try { apiRes = await API.method(); setData(apiData.xxx || [демо]); } catch { setData([демо]); }
// Паттерн B (синхронный без API): const loadData = () => { setData([демо]); setLoading(false); }
//   -> Результат: const loadData = async () => { try { const res = await API.method(); setData(res.data || [демо]); } catch { setData([демо]); } setLoading(false); }

const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, '..', 'client-accounting', 'src', 'pages');

// Файлы, которые нужно пропустить (уже полностью интегрированы вручную)
const skipFiles = [
    'Login.jsx', 'Dashboard.jsx', 'Products.jsx', 'Sales.jsx', 'Purchases.jsx',
    'Counterparties.jsx', 'Reports.jsx', 'Finance.jsx', 'Warehouse.jsx',
    'Employees.jsx', 'Invoices.jsx', 'CRM.jsx', 'Settings.jsx', 'Categories.jsx',
    'Shifts.jsx', 'Returns.jsx', 'Inventory.jsx', 'Analytics.jsx',
    'TwoFactorAuth.jsx', 'UserSessions.jsx', 'DigitalSignature.jsx', 'Notifications.jsx',
    'LoyaltySettings.jsx', 'LoyaltyProgram.jsx', 'LoyaltyCards.jsx',
    'ConfigurationSelector.jsx', 'GoodsReceiving.jsx', 'CashDrawer.jsx', 'CashOperations.jsx',
    'Development.jsx', 'Batches.jsx', 'ZReports.jsx', 'StockTransfers.jsx',
    'Deliveries.jsx'
];

let updated = 0;
let skipped = 0;
let errors = 0;

const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.jsx') && !skipFiles.includes(f));

for (const file of files) {
    const filePath = path.join(pagesDir, file);
    let content = fs.readFileSync(filePath, 'utf-8');

    // Проверяем, есть ли демо-данные (хардкоженные массивы в setState)
    const hasHardcodedArrays = /set\w+\(\[\s*\{[^}]+\}/.test(content);
    const hasHardcodedObjects = /set\w+\(\{\s*\w+:/.test(content);

    if (!hasHardcodedArrays && !hasHardcodedObjects) {
        skipped++;
        continue;
    }

    // Определяем какой API импортирован
    const apiImportMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]\.\.\/services\/api['"]/);
    if (!apiImportMatch) {
        console.log(`SKIP: ${file} — нет импорта API`);
        skipped++;
        continue;
    }
    const apiModules = apiImportMatch[1].split(',').map(s => s.trim()).filter(Boolean);
    const mainApi = apiModules[0]; // Основной API модуль

    // ============ Паттерн A: async loadData с неиспользуемым API-ответом ============
    // try { const apiRes = await module.method(); const apiData = apiRes.data || apiRes; console.log(...) } catch { console.warn(...) }
    // setState([демо-данные])
    const patternA = /const\s+loadData\s*=\s*async\s*\(\)\s*=>\s*\{\s*\n\s*try\s*\{\s*\n\s*const\s+apiRes\s*=\s*await\s+(\w+)\.(\w+)\([^)]*\);\s*\n\s*const\s+apiData\s*=\s*apiRes\.data\s*\|\|\s*apiRes;\s*\n\s*console\.log\([^)]+\);\s*\n\s*\}\s*catch\s*\(\w+\)\s*\{\s*\n\s*console\.warn\([^)]+\);\s*\n\s*\}/;

    const matchA = content.match(patternA);

    if (matchA) {
        const apiModule = matchA[1];
        const apiMethod = matchA[2];

        // Найти все setState([...]) и setState({...}) после catch блока до setLoading(false)
        const afterCatchIdx = content.indexOf(matchA[0]) + matchA[0].length;
        const loadingIdx = content.indexOf('setLoading(false)', afterCatchIdx);

        if (loadingIdx > afterCatchIdx) {
            const betweenSection = content.substring(afterCatchIdx, loadingIdx);

            // Найти имена state setters и их демо-данные
            const setStateMatches = [...betweenSection.matchAll(/\n\s*(set\w+)\((\[[\s\S]*?\]);|(\{[\s\S]*?\}\);)/g)];

            if (setStateMatches.length > 0) {
                // Перестроить loadData: использовать apiData в try, демо в catch
                const stateSetters = [];

                // Собрать все setter-вызовы
                const simplePattern = /\n(\s*)(set\w+)\(/g;
                let m;
                const tempSection = betweenSection;
                const setterLines = [];

                // Парсим каждый set... вызов
                let bracketStart = -1;
                let depth = 0;
                let currentSetter = '';
                let inSetter = false;
                let currentIndent = '';

                for (let i = 0; i < tempSection.length; i++) {
                    if (!inSetter) {
                        // Ищем начало setter-а
                        const remaining = tempSection.substring(i);
                        const setMatch = remaining.match(/^(set\w+)\(/);
                        if (setMatch) {
                            currentSetter = setMatch[1];
                            // Найти отступ
                            let j = i - 1;
                            while (j >= 0 && tempSection[j] === ' ') j--;
                            currentIndent = ' '.repeat(i - j - 1);

                            i += setMatch[0].length - 1;
                            depth = 1;
                            bracketStart = i + 1;
                            inSetter = true;
                        }
                    } else {
                        if (tempSection[i] === '(' || tempSection[i] === '[' || tempSection[i] === '{') depth++;
                        else if (tempSection[i] === ')' || tempSection[i] === ']' || tempSection[i] === '}') depth--;

                        if (depth === 0) {
                            const value = tempSection.substring(bracketStart, i);
                            setterLines.push({ setter: currentSetter, value: value.trim(), indent: currentIndent });
                            inSetter = false;
                        }
                    }
                }

                if (setterLines.length > 0) {
                    // Определить имя массива в API-ответе по имени setter-а
                    const getApiField = (setter) => {
                        const name = setter.replace(/^set/, '');
                        return name.charAt(0).toLowerCase() + name.slice(1);
                    };

                    // Собрать try-блок
                    let tryBlock = `        try {\n`;
                    tryBlock += `            const apiRes = await ${apiModule}.${apiMethod}();\n`;
                    tryBlock += `            const apiData = apiRes.data || apiRes;\n`;

                    for (const sl of setterLines) {
                        const field = getApiField(sl.setter);
                        if (sl.value.startsWith('[')) {
                            tryBlock += `            ${sl.setter}(apiData.${field} || apiData || ${sl.value});\n`;
                        } else if (sl.value.startsWith('{')) {
                            tryBlock += `            ${sl.setter}(apiData.${field} || apiData || ${sl.value});\n`;
                        } else {
                            tryBlock += `            ${sl.setter}(${sl.value});\n`;
                        }
                    }

                    tryBlock += `        } catch (err) {\n`;
                    tryBlock += `            console.warn('${file}: API недоступен, используем локальные данные');\n`;

                    for (const sl of setterLines) {
                        tryBlock += `            ${sl.setter}(${sl.value});\n`;
                    }

                    tryBlock += `        }\n`;
                    tryBlock += `        setLoading(false);`;

                    // Заменить весь loadData
                    const fullOld = content.substring(content.indexOf(matchA[0]), loadingIdx + 'setLoading(false);'.length);
                    const newLoadData = `const loadData = async () => {\n${tryBlock}`;

                    content = content.replace(fullOld, newLoadData);

                    fs.writeFileSync(filePath, content, 'utf-8');
                    console.log(`OK(A): ${file} -> ${apiModule}.${apiMethod}(), ${setterLines.length} setters`);
                    updated++;
                    continue;
                }
            }
        }
    }

    // ============ Паттерн B: синхронный loadData без async ============
    // const loadForecasts = () => { setData([...]); setLoading(false); }
    // ИЛИ const loadData = () => { setData([...]); setLoading(false); }

    const patternB = /const\s+(load\w+)\s*=\s*\(\)\s*=>\s*\{/;
    const matchB = content.match(patternB);

    if (matchB) {
        const funcName = matchB[1];
        const funcStart = content.indexOf(matchB[0]);

        // Найти конец функции (считаем {} скобки)
        let depth2 = 0;
        let funcEnd = funcStart;
        let started = false;
        for (let i = funcStart; i < content.length; i++) {
            if (content[i] === '{') { depth2++; started = true; }
            else if (content[i] === '}') { depth2--; }
            if (started && depth2 === 0) {
                funcEnd = i + 1;
                break;
            }
        }

        const funcBody = content.substring(funcStart, funcEnd);

        // Найти все setter-вызовы в этой функции
        const setterLines2 = [];
        let inSetter2 = false;
        let depth3 = 0;
        let currentSetter2 = '';
        let bracketStart2 = -1;

        for (let i = 0; i < funcBody.length; i++) {
            if (!inSetter2) {
                const remaining = funcBody.substring(i);
                const setMatch2 = remaining.match(/^(set\w+)\(/);
                if (setMatch2 && setMatch2[1] !== 'setLoading') {
                    currentSetter2 = setMatch2[1];
                    i += setMatch2[0].length - 1;
                    depth3 = 1;
                    bracketStart2 = i + 1;
                    inSetter2 = true;
                }
            } else {
                if (funcBody[i] === '(' || funcBody[i] === '[' || funcBody[i] === '{') depth3++;
                else if (funcBody[i] === ')' || funcBody[i] === ']' || funcBody[i] === '}') depth3--;

                if (depth3 === 0) {
                    const value2 = funcBody.substring(bracketStart2, i);
                    setterLines2.push({ setter: currentSetter2, value: value2.trim() });
                    inSetter2 = false;
                }
            }
        }

        if (setterLines2.length > 0) {
            const getApiField2 = (setter) => {
                const name = setter.replace(/^set/, '');
                return name.charAt(0).toLowerCase() + name.slice(1);
            };

            // Определить API метод
            let apiMethod2 = 'getAll';
            if (mainApi.includes('settings')) apiMethod2 = 'getAll';
            if (mainApi.includes('analytics')) apiMethod2 = 'getAll';

            let newFunc = `const ${funcName} = async () => {\n`;
            newFunc += `        try {\n`;
            newFunc += `            const apiRes = await ${mainApi}.${apiMethod2}();\n`;
            newFunc += `            const apiData = apiRes.data || apiRes;\n`;

            for (const sl of setterLines2) {
                const field = getApiField2(sl.setter);
                if (sl.value.startsWith('[') || sl.value.startsWith('{')) {
                    newFunc += `            ${sl.setter}(apiData.${field} || ${sl.value});\n`;
                } else {
                    newFunc += `            ${sl.setter}(${sl.value});\n`;
                }
            }

            newFunc += `        } catch (err) {\n`;
            newFunc += `            console.warn('${file}: API недоступен, используем локальные данные');\n`;

            for (const sl of setterLines2) {
                newFunc += `            ${sl.setter}(${sl.value});\n`;
            }

            newFunc += `        }\n`;
            newFunc += `        setLoading(false);\n`;
            newFunc += `    }`;

            content = content.replace(funcBody, newFunc);

            fs.writeFileSync(filePath, content, 'utf-8');
            console.log(`OK(B): ${file} -> ${mainApi}.${apiMethod2}(), ${setterLines2.length} setters`);
            updated++;
            continue;
        }
    }

    // Если ни один паттерн не сработал
    console.log(`MANUAL: ${file} — нужна ручная обработка`);
    errors++;
}

console.log(`\n=== Результат ===`);
console.log(`✅ Обновлено: ${updated}`);
console.log(`⏭️ Пропущено: ${skipped}`);
console.log(`⚠️ Ручная обработка: ${errors}`);
