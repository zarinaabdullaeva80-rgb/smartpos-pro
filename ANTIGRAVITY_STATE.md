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

*Последнее обновление телеметрии: 18.05.2026, 20:05:00*

### 💾 База Данных и Приложения:
- **Telegram Admin Bot**: 🟢 Протестирован владельцем вживую, вход успешный, функционал создания лицензий работает отлично.
- **Mobile PWA**: 🟢 Протестирован и собран (`npm run build:web` + `npm run mobile` на порту 8082), пути корректно перенастроены, запуск стабилен.
- **Desktop Client**: 🟢 Скомпилирован в портативный переносной `.exe` (`SmartPOS Pro 4.2.8.exe` в папке `client-accounting/dist-electron/`). Способ доставки: прямая передача (Telegram / Флешка).

### 🌿 Версионирование (Git):
- **Активная Ветка**: `main`
- **Состояние репозитория**: 🟢 Полностью синхронизировано и отправлено в облако!
- **Последний коммит**:
```text
feat: add Devices tab to Settings with sessions, login history and IP blocking
```

### ☁️ Облачные Эндпоинты (Railway):
- Главный: `https://smartpos-pro-production.up.railway.app`
- Резервный: `https://smartpos-pro-production-f885.up.railway.app`
- Вебхук Telegram: `🟢 Активен и настроен`

---
    
## 🎯 Текущий статус и следующие шаги:
1. **Пилотный запуск**: Передать собранный файл `SmartPOS Pro 4.2.8.exe` первым 3-5 дружественным магазинам через флешку или Telegram.
2. **Активация**: Генерировать первые боевые лицензионные ключи через Telegram-бот **[@SmartPOSproadmin_bot](https://t.me/SmartPOSproadmin_bot)**.
3. **Маркетинг и Лендинг**: Подготовить рекламные материалы и презентацию на основе созданного плана [commercial_launch_plan.md](file:///C:/Users/user/.gemini/antigravity/brain/bd4870a9-430a-471f-81bc-4d13ee92bbbe/commercial_launch_plan.md).
