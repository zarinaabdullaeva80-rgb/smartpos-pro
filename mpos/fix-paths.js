/**
 * Post-build скрипт для мобильного PWA
 * Переписывает абсолютные пути в dist/index.html на /mobile/ префикс
 * 
 * Запуск: node fix-paths.js (из папки mpos/)
 * Или:   npm run build:web (автоматически)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const indexPath = path.join(__dirname, 'dist', 'index.html');

if (!fs.existsSync(indexPath)) {
    console.error('❌ dist/index.html не найден. Сначала выполните: npx expo export --platform web');
    process.exit(1);
}

let html = fs.readFileSync(indexPath, 'utf-8');

// Заменяем корневые пути на /mobile/ префикс
html = html
    .replace(/src="\/(_expo\/)/g, 'src="/mobile/$1')
    .replace(/href="\/(_expo\/)/g, 'href="/mobile/$1')
    .replace(/href="\/favicon/g, 'href="/mobile/favicon')
    .replace(/src="\/assets\//g, 'src="/mobile/assets/')
    .replace(/href="\/assets\//g, 'href="/mobile/assets/');

fs.writeFileSync(indexPath, html, 'utf-8');
console.log('✅ Пути в dist/index.html переписаны на /mobile/ префикс');
