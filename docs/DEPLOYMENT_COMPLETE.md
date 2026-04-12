# 🚀 SmartPOS Pro - Руководство по Развёртыванию

## Быстрый старт (Локально)

### 1. Требования

- Node.js 18+
- PostgreSQL 14+
- npm или yarn

### 2. Настройка базы данных

```bash
# Создать базу данных
psql -U postgres -c "CREATE DATABASE accounting_db;"

# Применить миграции
cd server
npm run migrate
```

### 3. Настройка сервера

```bash
cd server

# Скопировать конфиг
copy .env.example .env

# Отредактировать .env (важные параметры):
# DATABASE_URL=postgresql://user:pass@localhost:5432/accounting_db
# JWT_SECRET=ваш-секретный-ключ-минимум-32-символа
# PORT=5000

# Установить зависимости
npm install

# Запустить
npm start
```

### 4. Настройка клиента

```bash
cd client-accounting

# Установить зависимости
npm install

# Запустить dev-сервер
npm run dev
```

Приложение доступно на <http://localhost:3000>

---

## 🌐 Production развёртывание

### Вариант 1: Railway (Рекомендуется)

1. Создайте аккаунт на [railway.app](https://railway.app)
2. Подключите GitHub репозиторий
3. Добавьте PostgreSQL плагин
4. Настройте переменные окружения:
   - `DATABASE_URL` (автоматически из PostgreSQL)
   - `JWT_SECRET`
   - `NODE_ENV=production`
5. Deploy!

### Вариант 2: VPS (Ubuntu)

```bash
# Обновить систему
sudo apt update && sudo apt upgrade -y

# Установить Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Установить PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Клонировать репозиторий
git clone https://github.com/YOUR_USERNAME/smartpos-pro.git
cd smartpos-pro

# Настроить и запустить сервер
cd server
npm install --production
npm start

# Для работы в фоне используйте PM2
npm install -g pm2
pm2 start src/index.js --name smartpos-server
pm2 save
pm2 startup
```

### Вариант 3: Docker

```bash
# Собрать образ
docker-compose build

# Запустить
docker-compose up -d
```

---

## 🔐 SSL Сертификат (HTTPS)

### С использованием Let's Encrypt

```bash
# Установить certbot
sudo apt install certbot python3-certbot-nginx

# Получить сертификат
sudo certbot --nginx -d your-domain.com

# Автоматическое продление
sudo certbot renew --dry-run
```

### Nginx конфигурация

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    location / {
        root /var/www/smartpos/client-accounting/dist;
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 📱 Telegram Bot

1. Создайте бота у [@BotFather](https://t.me/BotFather):
   - `/newbot`
   - Введите имя: SmartPOS Alerts
   - Скопируйте токен

2. Получите chat_id:
   - Напишите боту любое сообщение
   - Откройте: `https://api.telegram.org/bot<TOKEN>/getUpdates`
   - Найдите `chat.id`

3. Добавьте в `.env`:

```
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=987654321
```

---

## 📧 Email уведомления (SMTP)

### Gmail

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=app-specific-password
SMTP_FROM=SmartPOS <noreply@smartpos.uz>
```

⚠️ Для Gmail нужен [App Password](https://myaccount.google.com/apppasswords)

---

## ✅ Чек-лист перед запуском

- [ ] Настроена база данных PostgreSQL
- [ ] Применены все миграции (`npm run migrate`)
- [ ] Заполнен `.env` файл
- [ ] `JWT_SECRET` уникальный и длинный (32+ символов)
- [ ] `NODE_ENV=production`
- [ ] CORS настроен для ваших доменов
- [ ] SSL сертификат установлен (для production)
- [ ] Telegram бот настроен (опционально)
- [ ] Email SMTP настроен (опционально)
- [ ] Создан администратор (`npm run create-admin`)

---

## 🔧 Полезные команды

```bash
# Сервер
npm start          # Запуск
npm run dev        # Разработка (с nodemon)
npm test           # Тесты
npm run migrate    # Миграции БД

# Клиент
npm run dev        # Разработка
npm run build      # Production сборка
npm test           # Тесты

# Docker
docker-compose up -d      # Запуск
docker-compose down       # Остановка
docker-compose logs -f    # Логи
```
