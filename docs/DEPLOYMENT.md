# 🚀 Production Deployment Guide

## Prerequisites

- Ubuntu 20.04+ или Windows Server 2019+
- Node.js 18+
- PostgreSQL 16+
- Nginx (для reverse proxy)
- PM2 (для управления процессами)
- SSL сертификат (Let's Encrypt)

---

## 1. Подготовка сервера

### Ubuntu/Linux

```bash
# Обновить систему
sudo apt update && sudo apt upgrade -y

# Установить Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Установить PostgreSQL 16
sudo apt install -y postgresql-16 postgresql-contrib

# Установить PM2
sudo npm install -g pm2

# Установить Nginx
sudo apt install -y nginx

# Установить certbot для SSL
sudo apt install -y certbot python3-certbot-nginx
```

---

## 2. Настройка базы данных

```bash
# Войти в PostgreSQL
sudo -u postgres psql

# Создать пользователя и БД
CREATE USER accounting_user WITH PASSWORD 'secure_password_here';
CREATE DATABASE accounting_1c OWNER accounting_user;
GRANT ALL PRIVILEGES ON DATABASE accounting_1c TO accounting_user;
\q

# Применить миграции
cd /var/www/1c-accounting/database
for f in migrations/*.sql; do
    psql -U accounting_user -d accounting_1c -f "$f"
done
```

---

## 3. Деплой Backend

```bash
# Клонировать репозиторий
cd /var/www
git clone https://github.com/your-org/1c-accounting.git
cd 1c-accounting/server

# Установить зависимости
npm install --production

# Создать .env
cat > .env << EOF
PORT=5000
DATABASE_URL=postgresql://accounting_user:secure_password_here@localhost:5432/accounting_1c
JWT_SECRET=$(openssl rand -base64 32)
JWT_EXPIRES_IN=7d
NODE_ENV=production

# Опционально
REDIS_URL=redis://localhost:6379
SENTRY_DSN=https://your-sentry-dsn
EOF

# Запустить с PM2
pm2 start src/index.js --name "accounting-server"
pm2 save
pm2 startup
```

---

## 4. Деплой Frontend

```bash
cd /var/www/1c-accounting/client-accounting

# Установить зависимости
npm install

# Создать production build
npm run build

# Файлы будут в ./build/
```

---

## 5. Настройка Nginx

```bash
# Создать конфигурацию
sudo nano /etc/nginx/sites-available/1c-accounting

# Содержимое:
```

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    # SSL
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # Frontend
    root /var/www/1c-accounting/client-accounting/build;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # API
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Увеличить размер загружаемых файлов
    client_max_body_size 100M;
    
    # Gzip сжатие
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/css text/javascript application/javascript application/json;
}
```

```bash
# Включить сайт
sudo ln -s /etc/nginx/sites-available/1c-accounting /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Получить SSL сертификат
sudo certbot --nginx -d your-domain.com
```

---

## 6. Автоматические бэкапы

```bash
# Создать скрипт бэкапа
sudo nano /usr/local/bin/backup-1c.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/1c-accounting"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
POSTGRES_USER="accounting_user"
DB_NAME="accounting_1c"

# Создать директорию
mkdir -p $BACKUP_DIR

# Бэкап БД
PGPASSWORD="secure_password_here" pg_dump -U $POSTGRES_USER $DB_NAME | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

# Удалить старые бэкапы (>30 дней)
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +30 -delete

echo "Backup completed: db_$DATE.sql.gz"
```

```bash
# Сделать исполняемым
sudo chmod +x /usr/local/bin/backup-1c.sh

# Добавить в cron (каждый день в 2:00)
sudo crontab -e
# Добавить строку:
0 2 * * * /usr/local/bin/backup-1c.sh
```

---

## 7. Monitoring

### PM2 Monitoring

```bash
# Статус процессов
pm2 status

# Логи
pm2 logs

# Метрики
pm2 monit

# Web dashboard
pm2 web
```

### System Monitoring

```bash
# Установить htop
sudo apt install htop

# Мониторинг
htop
```

---

## 8. Обновление приложения

```bash
# Создать скрипт деплоя
nano /var/www/1c-accounting/deploy.sh
```

```bash
#!/bin/bash
cd /var/www/1c-accounting

# Остановить сервер
pm2 stop accounting-server

# Обновить код
git pull origin main

# Backend
cd server
npm install --production
pm2 restart accounting-server

# Frontend
cd ../client-accounting
npm install
npm run build

# Перезагрузить nginx
sudo systemctl reload nginx

echo "Deployment completed!"
```

```bash
chmod +x deploy.sh
```

---

## 9. Безопасность

### Firewall

```bash
# UFW
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### Fail2Ban

```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
```

### Регулярные обновления

```bash
# Автообновления
sudo apt install unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

---

## 10. Checklist перед запуском

- [  ] PostgreSQL настроен и миграции применены
- [ ] Backend запущен через PM2
- [ ] Frontend собран и размещён
- [ ] Nginx настроен с SSL
- [ ] Firewall настроен
- [ ] Автоматические бэкапы БД работают
- [ ] Мониторинг настроен
- [ ] .env файлы содержат production credentials
- [ ] Логи пишутся и ротируются
- [ ] Тестовый пользователь создан

---

## Troubleshooting

### Сервер не запускается
```bash
pm2 logs accounting-server
```

### 502 Bad Gateway
```bash
# Проверить запущен ли backend
pm2 status

# Проверить порт
sudo netstat -tlnp | grep 5000
```

### БД недоступна
```bash
sudo systemctl status postgresql
sudo tail -f /var/log/postgresql/postgresql-16-main.log
```

---

## Post-Deployment

1. Создать первого пользователя через API
2. Настроить Telegram бота
3. Настроить SMTP для email
4. Настроить резервное копирование на S3/Yandex Cloud
5. Настроить мониторинг (Sentry/Uptime Robot)

**Deployment complete! 🎉**
