# Railway Deployment Guide

## Деплой на Railway

### 1. Создание проекта

1. Зайдите на [railway.app](https://railway.app)
2. Создайте новый проект
3. Выберите "База данных" → **PostgreSQL**

### 2. Переменные окружения

После создания базы данных, добавьте следующие переменные в Railway:

```
NODE_ENV=production
PORT=5000
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=<сгенерируйте: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))">
SESSION_SECRET=<сгенерируйте аналогично>
CORS_ORIGIN=https://your-frontend-domain.railway.app
ENABLE_REDIS_CACHE=false
```

> **Примечание:** `${{Postgres.DATABASE_URL}}` - это ссылка на переменную PostgreSQL сервиса в Railway.

### 3. Деплой бэкенда

1. В Railway выберите "New Service" → "GitHub Repo"
2. Выберите ваш репозиторий
3. Укажите Root Directory: `server`
4. Railway автоматически обнаружит Node.js проект

### 4. Деплой фронтенда

1. Добавьте еще один сервис
2. Root Directory: `client-accounting`
3. Build Command: `npm run build`
4. Start Command: `npx serve -s dist -l 3000`

### 5. Применение миграций

После деплоя выполните миграции через Railway shell:

```bash
npm run migrate
```

Или запустите скрипт инициализации:

```bash
node src/scripts/createAdmin.js
```

### 6. Проверка

- Backend: `https://your-backend.railway.app/api/health`
- Frontend: `https://your-frontend.railway.app`
- Swagger: `https://your-backend.railway.app/api-docs`

## Полезные команды

```bash
# Локальное тестирование с production настройками
NODE_ENV=production npm start

# Генерация секретов
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```
