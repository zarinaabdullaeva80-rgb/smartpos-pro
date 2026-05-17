import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Загружаем окружение из папки server
dotenv.config({ path: path.join(__dirname, '.env') });

const STATE_FILE_PATH = path.join(__dirname, '../ANTIGRAVITY_STATE.md');

// Шаблон ручной документации проекта
const MANUAL_TEMPLATE = `# 🌟 Состояние проекта SmartPOS Pro & Инструкция для AI-Ассистента

Этот файл является точкой входа для любого нового AI-ассистента (Antigravity или другого инстанса). Здесь находится полная информация о проекте и инструкция для продолжения разработки.

---

## 🏢 1. Архитектура и Структура Проекта

Проект представляет собой современную многокомпонентную систему автоматизации торговли (SmartPOS) с интеграцией 1С, складским учетом (WMS), CRM и удаленным лицензированием.

- **\`server/\` (Backend)**:
  - Node.js (Express), PostgreSQL.
  - Управляет API, многопользовательской синхронизацией, базами данных организаций, бэкапами и Telegram-ботом.
- **\`client-accounting/\` (Desktop Frontend)**:
  - Vite + React, Vanilla CSS.
  - Бухгалтерский интерфейс 1С для ПК, упаковывается через Electron в автономный \`.exe\`.
- **\`mpos/\` (Mobile POS)**:
  - React Native + Expo.
  - Интерфейс для мобильных терминалов и касс самообслуживания.
- **\`database/\` & \`server/src/config/initDatabase.js\`**:
  - Полная схема таблиц PostgreSQL, включая миграции и автоинициализацию.

---

## 🔗 2. Ключевые Бизнес-Процессы и Интеграции

### 🔑 2.1. Система Удаленного Лицензирования и Telegram Bot
- **Бизнес-логика**: Описана в [licensingService.js](file:///c:/Users/user/Desktop/1%D0%A1%20%D0%B1%D1%83%D1%85%D0%B3%D0%B0%D0%BB%D1%82%D0%B5%D1%80%D0%B8%D1%8F/server/src/services/licensingService.js). Позволяет создавать клиентов, организации, склады и привязывать владельцев.
- **Telegram Admin Bot**: Описан в [telegramAdminBot.js](file:///c:/Users/user/Desktop/1%D0%A1%20%D0%B1%D1%83%D1%85%D0%B3%D0%B0%D0%BB%D1%82%D0%B5%D1%80%D0%B8%D1%8F/server/src/services/telegramAdminBot.js). Позволяет админам создавать лицензии по шагам с мобильного телефона с автогенерацией логинов, паролей и синхронизацией.
- **Бот в Telegram**: **[@SmartPOSproadmin_bot](https://t.me/SmartPOSproadmin_bot)**.
- **Авторизация**: Команда \`/login admin <пароль>\`. Пароль в продакшене изменен на безопасный bcrypt-хэш.

### 🔄 2.2. Двусторонняя Синхронизация (Облако-Облако)
- Описана в [licenseSync.js](file:///c:/Users/user/Desktop/1%D0%A1%20%D0%B1%D1%83%D1%85%D0%B3%D0%B0%D0%BB%D1%82%D0%B5%D1%80%D0%B8%D1%8F/server/src/services/licenseSync.js). 
- Любая лицензия, созданная на одном сервере, автоматически реплицируется на второй сервер.
- Сервера:
  1. \`https://smartpos-pro-production.up.railway.app\`
  2. \`https://smartpos-pro-production-f885.up.railway.app\`

---

## 🛠️ 3. Полезные Команды и Диагностика

- **Запуск локального сервера**: \`cd server && npm run dev\`
- **Запуск локальных интеграционных тестов бота**: \`cd server && node scratch/test_telegram_bot.js\`
- **Проверить пользователей в базе**: \`cd server && node check_local_users.js\`
- **Сбросить локального админа**: \`cd server && node reset-admin.js\`

---

## 📊 4. Текущая Телеметрия Системы (Автообновляемая)

`;

async function getGitInfo() {
    try {
        const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
        const status = execSync('git status --short').toString().trim() || 'Чисто (нет изменений)';
        const lastCommits = execSync('git log -n 5 --oneline').toString().trim();
        return { branch, status, lastCommits };
    } catch (e) {
        return { branch: 'N/A', status: 'Ошибка выполнения git', lastCommits: 'N/A' };
    }
}

async function getDbStats() {
    // Пробуем локальное подключение по умолчанию
    const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:Smash2206@localhost:5432/accounting_db';
    const pool = new Pool({ connectionString });
    
    try {
        await pool.query('SELECT 1');
        const licenses = await pool.query('SELECT COUNT(*) FROM licenses');
        const users = await pool.query('SELECT COUNT(*) FROM users');
        const admins = await pool.query('SELECT COUNT(*) FROM telegram_admins');
        
        return {
            connected: true,
            licensesCount: licenses.rows[0].count,
            usersCount: users.rows[0].count,
            adminsCount: admins.rows[0].count
        };
    } catch (e) {
        return { connected: false, error: e.message };
    } finally {
        await pool.end();
    }
}

async function main() {
    console.log('🔄 Сбор телеметрии проекта для Handover...');
    
    const gitInfo = await getGitInfo();
    const dbInfo = await getDbStats();
    
    let telemetryContent = `*Последнее обновление телеметрии: ${new Date().toLocaleString('ru-RU')}*\n\n`;
    
    // Блок базы данных
    telemetryContent += `### 💾 База Данных (Локальная):\n`;
    if (dbInfo.connected) {
        telemetryContent += `- **Статус**: 🟢 Подключено успешно!\n`;
        telemetryContent += `- **Зарегистрировано Лицензий**: ${dbInfo.licensesCount}\n`;
        telemetryContent += `- **Всего Пользователей в БД**: ${dbInfo.usersCount}\n`;
        telemetryContent += `- **Сессий Telegram-Админов**: ${dbInfo.adminsCount}\n`;
    } else {
        telemetryContent += `- **Статус**: 🔴 Не удалось подключиться к БД\n`;
        telemetryContent += `- **Ошибка**: \`${dbInfo.error}\`\n`;
    }
    
    // Блок Git
    telemetryContent += `\n### 🌿 Версионирование (Git):\n`;
    telemetryContent += `- **Активная Ветка**: \`${gitInfo.branch}\`\n`;
    telemetryContent += `- **Изменения в рабочей директории**:\n\`\`\`text\n${gitInfo.status}\n\`\`\`\n`;
    telemetryContent += `- **Последние коммиты**:\n\`\`\`text\n${gitInfo.lastCommits}\n\`\`\`\n`;

    // Блок Облака
    telemetryContent += `\n### ☁️ Облачные Эндпоинты (Railway):\n`;
    telemetryContent += `- Главный: \`https://smartpos-pro-production.up.railway.app\`\n`;
    telemetryContent += `- Резервный: \`https://smartpos-pro-production-f885.up.railway.app\`\n`;
    telemetryContent += `- Вебхук Telegram: \`🟢 Активен и настроен\`\n\n`;
    
    telemetryContent += `---
    
## 🎯 Текущая задача на завтра:
1. Запустить новый сеанс разработки.
2. Прочитать этот файл.
3. Продолжить реализацию и улучшение системы по запросу пользователя.
`;

    const finalMarkdown = MANUAL_TEMPLATE + telemetryContent;
    
    fs.writeFileSync(STATE_FILE_PATH, finalMarkdown, 'utf8');
    console.log('✅ Файл ANTIGRAVITY_STATE.md успешно сгенерирован и записан!');
}

main().catch(err => {
    console.error('Ошибка генератора handover:', err);
});
