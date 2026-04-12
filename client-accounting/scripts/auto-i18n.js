#!/usr/bin/env node
/**
 * Auto-i18n Script for SmartPOS Pro
 * 
 * Автоматически находит русские строки в JSX-файлах и заменяет их на t() вызовы.
 * Генерирует ключи для словарей ru.js и uz.js.
 * 
 * Использование:
 *   node scripts/auto-i18n.js              — только анализ (dry run)
 *   node scripts/auto-i18n.js --apply      — применить изменения
 *   node scripts/auto-i18n.js --file Dashboard.jsx  — один файл
 */

const fs = require('fs');
const path = require('path');

const PAGES_DIR = path.join(__dirname, '..', 'src', 'pages');
const I18N_DIR = path.join(__dirname, '..', 'src', 'i18n');
const APPLY = process.argv.includes('--apply');
const SINGLE_FILE = process.argv.includes('--file') 
  ? process.argv[process.argv.indexOf('--file') + 1] 
  : null;

// Regex для поиска русских строк в JSX
const CYRILLIC_RE = /[а-яА-ЯёЁ]/;

// Строки которые НЕ надо переводить (комменты, console.log и т.д.)
const SKIP_PATTERNS = [
  /^\s*\/\//,          // однострочные комментарии
  /^\s*\*/,            // многострочные комментарии
  /console\.(log|warn|error|info)/,  // console
  /handleError\(/,     // error messages (runtime)
  /handleSuccess\(/,   // success messages (runtime)
  /toast\./,           // toast notifications
  /confirm\(/,         // confirm dialogs
  /alert\(/,           // alert dialogs
  /throw new/,         // exceptions
  /\.error\(/,         // error handlers
  /\.success\(/,       // success handlers
  /placeholder=/,      // placeholders — can keep as fallback
];

// Контексты JSX, где строки нужно переводить
const JSX_TEXT_PATTERNS = [
  // >Русский текст< — текст между тегами
  { regex: />([\s]*[а-яА-ЯёЁ][^<>{]*?)</g, type: 'jsx-text' },
  // title="Русский"
  { regex: /title="([^"]*[а-яА-ЯёЁ][^"]*)"/g, type: 'attr' },
  // label: 'Русский' или name: 'Русский' в objects  
  { regex: /(?:label|name|description):\s*'([^']*[а-яА-ЯёЁ][^']*)'/g, type: 'object-prop' },
];

// Генерация ключа из русского текста
function generateKey(pageName, russianText) {
  // Транслитерация для ключа
  const translit = {
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh',
    'з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o',
    'п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'ts',
    'ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya',
    ' ':'_', '/':'_', '\\':'_', '.':'', ',':'', ':':'', '(':'', ')':'',
    '—':'', '–':'', '«':'', '»':'', '"':'', "'":"", '!':'', '?':'',
    '+':'', '-':'_', '%':'pct', '№':'num', '₽':'', '•':'',
  };
  
  const text = russianText.trim().toLowerCase().slice(0, 40);
  let key = '';
  for (const char of text) {
    key += translit[char] || translit[char.toLowerCase()] || '';
  }
  // Clean up
  key = key.replace(/_+/g, '_').replace(/^_|_$/g, '');
  if (!key) key = 'text_' + Math.random().toString(36).slice(2, 6);
  
  const section = pageName.replace(/\.jsx$/i, '').replace(/([A-Z])/g, (m, c, i) => 
    i > 0 ? c.toLowerCase() : c.toLowerCase()
  );
  // camelCase the section
  const sectionKey = section.charAt(0).toLowerCase() + section.slice(1);
  
  return `${sectionKey}.${key}`;
}

// Анализ одного файла
function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath);
  
  // Пропустить если уже имеет i18n
  const hasI18n = content.includes('useI18n');
  
  const findings = [];
  const lines = content.split('\n');
  
  lines.forEach((line, lineNo) => {
    // Пропустить строки с паттернами, которые не нужно переводить
    if (SKIP_PATTERNS.some(p => p.test(line))) return;
    
    // Ищем русские строки в JSX контексте
    // 1. Текст между тегами: >Русский текст<
    const jsxTextRe = />([^<>{}]*[а-яА-ЯёЁ][^<>{}]*)</g;
    let match;
    while ((match = jsxTextRe.exec(line)) !== null) {
      const text = match[1].trim();
      if (text.length < 2) continue;
      // Не трогать если уже в t() или {t(
      if (line.includes(`{t(`) && line.indexOf(`{t(`) < match.index) continue;
      
      findings.push({
        line: lineNo + 1,
        text,
        type: 'jsx-text',
        context: line.trim().slice(0, 100)
      });
    }
    
    // 2. Русские строки в атрибутах: title="Русский", placeholder="Русский"
    const attrRe = /(title|aria-label)="([^"]*[а-яА-ЯёЁ][^"]*)"/g;
    while ((match = attrRe.exec(line)) !== null) {
      findings.push({
        line: lineNo + 1,
        text: match[2],
        type: 'attribute',
        attr: match[1],
        context: line.trim().slice(0, 100)
      });
    }
    
    // 3. Строки в объектах: label: 'Русский', name: 'Русский'
    const objRe = /(label|name|description|sheetName|filename):\s*'([^']*[а-яА-ЯёЁ][^']*)'/g;
    while ((match = objRe.exec(line)) !== null) {
      findings.push({
        line: lineNo + 1,
        text: match[2],
        type: 'object-prop',
        prop: match[1],
        context: line.trim().slice(0, 100)
      });
    }
    
    // 4. Строки в объектах с двойными кавычками
    const objRe2 = /(label|name|description|sheetName|filename):\s*"([^"]*[а-яА-ЯёЁ][^"]*)"/g;
    while ((match = objRe2.exec(line)) !== null) {
      findings.push({
        line: lineNo + 1,
        text: match[2],
        type: 'object-prop',
        prop: match[1],
        context: line.trim().slice(0, 100)
      });
    }
  });
  
  return { fileName, filePath, hasI18n, findings, content };
}

// Применить i18n к файлу
function applyI18n(analysis) {
  let { content, fileName, findings } = analysis;
  const pageName = fileName.replace('.jsx', '');
  const sectionKey = pageName.charAt(0).toLowerCase() + pageName.slice(1);
  
  const dictEntries = {};
  
  if (findings.length === 0) return { content, dictEntries, changed: false };
  
  // 1. Добавить import если нет
  if (!analysis.hasI18n) {
    // Найти последний import
    const importLines = content.split('\n');
    let lastImportLine = -1;
    importLines.forEach((line, i) => {
      if (line.match(/^import\s/) || line.match(/^import\s*{/)) {
        lastImportLine = i;
      }
    });
    
    if (lastImportLine >= 0) {
      importLines.splice(lastImportLine + 1, 0, "import { useI18n } from '../i18n';");
      content = importLines.join('\n');
    }
    
    // 2. Добавить const { t } = useI18n(); после первого useState или в начале компонента
    // Ищем паттерн: const ComponentName = () => { или function ComponentName() {
    const hookPattern = /(?:const\s+\w+\s*=\s*\([^)]*\)\s*=>|function\s+\w+\s*\([^)]*\))\s*{/;
    const hookMatch = content.match(hookPattern);
    if (hookMatch) {
      const idx = content.indexOf(hookMatch[0]) + hookMatch[0].length;
      // Найти первый useState или const после открывающей скобки
      const afterHook = content.slice(idx);
      const firstConst = afterHook.match(/\n(\s*)(const\s)/);
      if (firstConst) {
        const insertPos = idx + firstConst.index + 1;
        const indent = firstConst[1];
        content = content.slice(0, insertPos) + 
          `${indent}const { t } = useI18n();\n` + 
          content.slice(insertPos);
      }
    }
  }
  
  // 3. Заменить русские строки на t() вызовы
  // Сначала сортируем по длине строки (длинные первыми, чтобы не было частичных замен)
  const uniqueTexts = [...new Set(findings.map(f => f.text))];
  uniqueTexts.sort((a, b) => b.length - a.length);
  
  for (const text of uniqueTexts) {
    const finding = findings.find(f => f.text === text);
    const key = generateKey(fileName, text);
    const shortKey = key.split('.').pop();
    
    dictEntries[shortKey] = text;
    
    if (finding.type === 'jsx-text') {
      // >Русский текст<  →  >{t('section.key', 'Русский текст')}<
      // Нужно быть осторожным — текст может быть частью строки с иконками
      const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`>(\\s*)${escaped}(\\s*)<`, 'g');
      content = content.replace(re, `>$1{t('${key}', '${text.replace(/'/g, "\\'")}')}\$2<`);
      
      // Если не получилось (текст без закрывающего тега рядом)
      const re2 = new RegExp(`>\\s*${escaped}\\s*$`, 'gm');
      content = content.replace(re2, (match) => {
        if (content.includes(`{t('${key}'`)) return match; // уже заменено
        return `>{t('${key}', '${text.replace(/'/g, "\\'")}')}`;
      });
    } else if (finding.type === 'attribute') {
      // title="Русский"  →  title={t('key', 'Русский')}
      const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`${finding.attr}="${escaped}"`, 'g');
      content = content.replace(re, `${finding.attr}={t('${key}', '${text.replace(/'/g, "\\'")}')}`);
    }
  }
  
  return { content, dictEntries: { [sectionKey]: dictEntries }, changed: true };
}

// ============ MAIN ============

console.log('🌍 SmartPOS Auto-i18n Scanner\n');
console.log(APPLY ? '⚡ РЕЖИМ ПРИМЕНЕНИЯ (--apply)\n' : '🔍 РЕЖИМ АНАЛИЗА (добавьте --apply для применения)\n');

// Получить список файлов
let files = fs.readdirSync(PAGES_DIR)
  .filter(f => f.endsWith('.jsx'))
  .map(f => path.join(PAGES_DIR, f));

if (SINGLE_FILE) {
  files = files.filter(f => path.basename(f) === SINGLE_FILE);
  if (files.length === 0) {
    console.error(`❌ Файл ${SINGLE_FILE} не найден в ${PAGES_DIR}`);
    process.exit(1);
  }
}

// Анализ
const results = [];
let totalFindings = 0;
const allDictEntries = {};

for (const file of files) {
  const analysis = analyzeFile(file);
  
  if (analysis.findings.length === 0) continue;
  
  totalFindings += analysis.findings.length;
  
  console.log(`\n📄 ${analysis.fileName} ${analysis.hasI18n ? '(уже i18n)' : '(нет i18n)'}`);
  console.log(`   Найдено русских строк: ${analysis.findings.length}`);
  
  // Показать первые 5 находок
  analysis.findings.slice(0, 5).forEach(f => {
    console.log(`   L${f.line}: [${f.type}] "${f.text.slice(0, 50)}${f.text.length > 50 ? '...' : ''}"`);
  });
  if (analysis.findings.length > 5) {
    console.log(`   ... и ещё ${analysis.findings.length - 5}`);
  }
  
  if (APPLY) {
    const result = applyI18n(analysis);
    if (result.changed) {
      fs.writeFileSync(file, result.content, 'utf-8');
      console.log(`   ✅ Файл обновлён`);
      
      // Собираем словарные записи
      Object.assign(allDictEntries, result.dictEntries);
    }
  }
  
  results.push(analysis);
}

// Вывести сводку
console.log('\n' + '='.repeat(60));
console.log(`📊 ИТОГО: ${results.length} файлов с русскими строками, ${totalFindings} строк для перевода`);

// Список файлов без i18n
const withoutI18n = results.filter(r => !r.hasI18n);
if (withoutI18n.length > 0) {
  console.log(`\n🔴 Файлы БЕЗ i18n (${withoutI18n.length}):`);
  withoutI18n.forEach(r => {
    console.log(`   ${r.fileName} — ${r.findings.length} строк`);
  });
}

// Если применён — вывести словарные записи
if (APPLY && Object.keys(allDictEntries).length > 0) {
  const dictPath = path.join(__dirname, '..', 'scripts', 'generated-dict-keys.json');
  fs.writeFileSync(dictPath, JSON.stringify(allDictEntries, null, 2), 'utf-8');
  console.log(`\n📝 Ключи словарей сохранены: ${dictPath}`);
  console.log('   Добавьте их вручную в ru.js и uz.js');
}

if (!APPLY) {
  console.log('\n💡 Чтобы применить изменения: node scripts/auto-i18n.js --apply');
  console.log('💡 Для одного файла: node scripts/auto-i18n.js --apply --file CRM.jsx');
}
