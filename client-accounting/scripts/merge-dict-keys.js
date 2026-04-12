#!/usr/bin/env node
/**
 * Merge generated dictionary keys into ru.js and uz.js
 * 
 * Reads generated-dict-keys.json and adds missing sections/keys 
 * to the existing dictionaries.
 * 
 * Usage: node scripts/merge-dict-keys.js
 */

const fs = require('fs');
const path = require('path');

const KEYS_FILE = path.join(__dirname, 'generated-dict-keys.json');
const RU_FILE = path.join(__dirname, '..', 'src', 'i18n', 'ru.js');
const UZ_FILE = path.join(__dirname, '..', 'src', 'i18n', 'uz.js');

// Simple Russian -> Uzbek translation map for common words
const RU_TO_UZ = {
  // Common words
  'Загрузка...': 'Yuklanmoqda...',
  'Сохранить': 'Saqlash',
  'Отмена': 'Bekor qilish',
  'Удалить': 'O\'chirish',
  'Редактировать': 'Tahrirlash',
  'Добавить': 'Qo\'shish',
  'Закрыть': 'Yopish',
  'Поиск': 'Qidirish',
  'Фильтр': 'Filtr',
  'Применить': 'Qo\'llash',
  'Сбросить': 'Tozalash',
  'Экспорт': 'Eksport',
  'Импорт': 'Import',
  'Настройки': 'Sozlamalar',
  'Статус': 'Holat',
  'Дата': 'Sana',
  'Название': 'Nomi',
  'Описание': 'Tavsif',
  'Действия': 'Amallar',
  'Итого': 'Jami',
  'Обновить': 'Yangilash',
  'Создать': 'Yaratish',
  'Категория': 'Kategoriya',
  'Тип': 'Turi',
  'Сумма': 'Summa',
  'Количество': 'Miqdor',
  'Цена': 'Narx',
  'Товар': 'Tovar',
  'Клиент': 'Mijoz',
  'Дата начала': 'Boshlanish sanasi',
  'Дата окончания': 'Tugash sanasi',
  'Активен': 'Faol',
  'Неактивен': 'Nofaol',
  'Все': 'Barchasi',
  'Да': 'Ha',
  'Нет': 'Yo\'q',
  'Ошибка': 'Xato',
  'Успешно': 'Muvaffaqiyatli',
};

// Generate a basic Uzbek translation (transliteration-based)
function translateToUzbek(russianText) {
  // Check exact match first
  if (RU_TO_UZ[russianText]) return RU_TO_UZ[russianText];
  
  // For now, keep Russian text as placeholder with [UZ] prefix
  // This makes it easy to find and translate later
  return russianText; // Keep as-is, will use fallback
}

// Read generated keys
if (!fs.existsSync(KEYS_FILE)) {
  console.error('❌ Файл generated-dict-keys.json не найден. Сначала запустите auto-i18n.js --apply');
  process.exit(1);
}

const generatedKeys = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf-8'));

// Read existing dictionaries
const ruContent = fs.readFileSync(RU_FILE, 'utf-8');
const uzContent = fs.readFileSync(UZ_FILE, 'utf-8');

// Find which sections are already in the dictionaries
const existingSectionsRu = new Set();
const sectionRegex = /^\s+(\w+):\s*\{/gm;
let match;
while ((match = sectionRegex.exec(ruContent)) !== null) {
  existingSectionsRu.add(match[1]);
}

console.log('📊 Существующие секции в ru.js:', [...existingSectionsRu].join(', '));
console.log('📊 Новые секции из скрипта:', Object.keys(generatedKeys).length);

// Generate new sections to add
const newSectionsRu = [];
const newSectionsUz = [];
let addedSections = 0;
let addedKeys = 0;

for (const [section, keys] of Object.entries(generatedKeys)) {
  if (existingSectionsRu.has(section)) {
    // Section exists — skip (existing manual translations are better)
    continue;
  }
  
  addedSections++;
  const keyEntries = Object.entries(keys);
  addedKeys += keyEntries.length;
  
  // Generate RU section
  let ruSection = `\n  // === ${section} ===\n  ${section}: {\n`;
  for (const [key, value] of keyEntries) {
    const escaped = value.replace(/'/g, "\\'");
    ruSection += `    ${key}: '${escaped}',\n`;
  }
  ruSection += '  },\n';
  newSectionsRu.push(ruSection);
  
  // Generate UZ section (use same values as fallback - they'll be translated via t() fallback mechanism)
  let uzSection = `\n  // === ${section} ===\n  ${section}: {\n`;
  for (const [key, value] of keyEntries) {
    const uzValue = translateToUzbek(value);
    const escaped = uzValue.replace(/'/g, "\\'");
    uzSection += `    ${key}: '${escaped}',\n`;
  }
  uzSection += '  },\n';
  newSectionsUz.push(uzSection);
}

if (addedSections === 0) {
  console.log('✅ Все секции уже присутствуют в словарях. Нечего добавлять.');
  process.exit(0);
}

// Insert new sections before the closing }; in each dictionary
const insertBeforeClosing = (content, sections) => {
  const lastClosing = content.lastIndexOf('};');
  if (lastClosing === -1) {
    console.error('❌ Не найден закрывающий }; в файле словаря');
    return content;
  }
  return content.slice(0, lastClosing) + sections.join('') + '\n' + content.slice(lastClosing);
};

const newRuContent = insertBeforeClosing(ruContent, newSectionsRu);
const newUzContent = insertBeforeClosing(uzContent, newSectionsUz);

fs.writeFileSync(RU_FILE, newRuContent, 'utf-8');
fs.writeFileSync(UZ_FILE, newUzContent, 'utf-8');

console.log(`\n✅ Добавлено ${addedSections} новых секций и ${addedKeys} ключей`);
console.log(`   📄 ru.js обновлён`);
console.log(`   📄 uz.js обновлён`);
console.log(`\n⚠️  Узбекские переводы используют русский текст как placeholder.`);
console.log(`   Для качественного перевода отредактируйте uz.js вручную.`);
