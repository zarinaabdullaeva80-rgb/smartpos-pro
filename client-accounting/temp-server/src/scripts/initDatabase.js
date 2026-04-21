/**
 * DEPRECATED: Этот скрипт устарел.
 * Используйте основную инициализацию через server/src/config/initDatabase.js
 * 
 * Этот файл сохранён для обратной совместимости.
 * При запуске он перенаправляет на актуальную инициализацию.
 */

import pool from '../config/database.js';
import { initDatabase } from '../config/initDatabase.js';

console.log('⚠️  Этот скрипт (scripts/initDatabase.js) устарел.');
console.log('📦 Используется актуальная инициализация из config/initDatabase.js');
console.log('');

// Перенаправляем на актуальную инициализацию
try {
    await initDatabase(pool);
    console.log('');
    console.log('✅ Инициализация завершена через config/initDatabase.js');
    process.exit(0);
} catch (error) {
    console.error('❌ Ошибка инициализации:', error.message);
    process.exit(1);
}
