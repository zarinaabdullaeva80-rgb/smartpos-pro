// Находим .jsx файлы в pages/, которые НЕ содержат import из services/api
const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, '..', 'client-accounting', 'src', 'pages');

const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.jsx'));

const missing = [];
const connected = [];

for (const file of files) {
    const content = fs.readFileSync(path.join(pagesDir, file), 'utf-8');
    if (content.includes("from '../services/api'") || content.includes('from "../services/api"')) {
        connected.push(file);
    } else {
        missing.push(file);
    }
}

console.log(`=== Подключены к API: ${connected.length} ===`);
console.log(`\n=== НЕ подключены к API: ${missing.length} ===`);
missing.forEach(f => console.log(`  - ${f}`));
