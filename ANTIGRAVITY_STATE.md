# 🌟 Состояние проекта SmartPOS Pro & Инструкция для AI-Ассистента

Этот файл является точкой входа для любого нового AI-ассистента (Antigravity или другого инстанса). Здесь находится полная информация о проекте и инструкция для продолжения разработки.

---

## 🏢 1. Архитектура и Структура Проекта

Проект представляет собой современную многокомпонентную систему автоматизации торговли (SmartPOS) с интеграцией 1С, складским учетом (WMS), CRM и удаленным лицензированием.

- **`server/` (Backend)**:
  - Node.js (Express), PostgreSQL.
  - Управляет API, многопользовательской синхронизацией, базами данных организаций, бэкапами и Telegram-ботом.
- **`client-accounting/` (Desktop Frontend)**:
  - Vite + React, Vanilla CSS.
  - Бухгалтерский интерфейс 1С для ПК, упаковывается через Electron в автономный `.exe`.
- **`mpos/` (Mobile POS)**:
  - React Native + Expo.
  - Интерфейс для мобильных терминалов и касс самообслуживания.
- **`database/` & `server/src/config/initDatabase.js`**:
  - Полная схема таблиц PostgreSQL, включая миграции и автоинициализацию.

---

## 🔗 2. Ключевые Бизнес-Процессы и Интеграции

### 🔑 2.1. Система Удаленного Лицензирования и Telegram Bot
- **Бизнес-логика**: Описана в [licensingService.js](file:///c:/Users/user/Desktop/1%D0%A1%20%D0%B1%D1%83%D1%85%D0%B3%D0%B0%D0%BB%D1%82%D0%B5%D1%80%D0%B8%D1%8F/server/src/services/licensingService.js). Позволяет создавать клиентов, организации, склады и привязывать владельцев.
- **Telegram Admin Bot**: Описан в [telegramAdminBot.js](file:///c:/Users/user/Desktop/1%D0%A1%20%D0%B1%D1%83%D1%85%D0%B3%D0%B0%D0%BB%D1%82%D0%B5%D1%80%D0%B8%D1%8F/server/src/services/telegramAdminBot.js). Позволяет админам создавать лицензии по шагам с мобильного телефона с автогенерацией логинов, паролей и синхронизацией.
- **Бот в Telegram**: **[@SmartPOSproadmin_bot](https://t.me/SmartPOSproadmin_bot)**.
- **Авторизация**: Команда `/login admin <пароль>`. Пароль в продакшене изменен на безопасный bcrypt-хэш.

### 🔄 2.2. Двусторонняя Синхронизация (Облако-Облако)
- Описана в [licenseSync.js](file:///c:/Users/user/Desktop/1%D0%A1%20%D0%B1%D1%83%D1%85%D0%B3%D0%B0%D0%BB%D1%82%D0%B5%D1%80%D0%B8%D1%8F/server/src/services/licenseSync.js). 
- Любая лицензия, созданная на одном сервере, автоматически реплицируется на второй сервер.
- Сервера:
  1. `https://smartpos-pro-production.up.railway.app`
  2. `https://smartpos-pro-production-f885.up.railway.app`

---

## 🛠️ 3. Полезные Команды и Диагностика

- **Запуск локального сервера**: `cd server && npm run dev`
- **Запуск локальных интеграционных тестов бота**: `cd server && node scratch/test_telegram_bot.js`
- **Проверить пользователей в базе**: `cd server && node check_local_users.js`
- **Сбросить локального админа**: `cd server && node reset-admin.js`

---

## 📊 4. Текущая Телеметрия Системы (Автообновляемая)

*Последнее обновление телеметрии: 17.05.2026, 20:11:47*

### 💾 База Данных (Локальная):
- **Статус**: 🟢 Подключено успешно!
- **Зарегистрировано Лицензий**: 8
- **Всего Пользователей в БД**: 11
- **Сессий Telegram-Админов**: 0

### 🌿 Версионирование (Git):
- **Активная Ветка**: `main`
- **Изменения в рабочей директории**:
```text
M package.json
?? ../ANTIGRAVITY_STATE.md
?? ../antigravity_handover.js
?? antigravity_handover.js
?? scratch/check_production_users.js
?? scratch/create_prod_admins_table.js
?? scratch/reset_prod_admin.js
?? scratch/test_telegram_bot.js
```
- **Последние коммиты**:
```text
0843fb2 feat: add Telegram Admin Bot for remote license management\n\n- Add licensingService.js with consolidated license CRUD logic\n- Add telegramAdminBot.js with interactive license wizard\n- Add telegram_admins table migration in initDatabase.js\n- Add webhook route POST /api/telegram/webhook/admin\n- Update licenseSync.js for cloud-to-cloud replication\n- Integrate bot init in index.js (webhook + long polling modes)
a7e5e24 Build and pack latest SmartPOS Pro portable EXE package
6bc41d5 Implement detailed inventory history logs and shifts management enhancements across mobile and desktop clients
dd7df34 security: remove temp fix-user-license endpoint
8706a31 temp: fix-user-license endpoint
```

### ☁️ Облачные Эндпоинты (Railway):
- Главный: `https://smartpos-pro-production.up.railway.app`
- Резервный: `https://smartpos-pro-production-f885.up.railway.app`
- Вебхук Telegram: `🟢 Активен и настроен`

---
    
## 🎯 Текущая задача на завтра:
1. Запустить новый сеанс разработки.
2. Прочитать этот файл.
3. Продолжить реализацию и улучшение системы по запросу пользователя.
