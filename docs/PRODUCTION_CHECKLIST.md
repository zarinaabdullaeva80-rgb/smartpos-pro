# Production Deployment Checklist

## ✅ Полный чеклист готовности

### Обязательно (Required)
- [x] База данных настроена и работает
- [x] Все миграции применены
- [x] Backend запускается без ошибок
- [x] Frontend собирается и работает
- [x] Аутентификация функционирует
- [x] API endpoints отвечают корректно
- [x] Все модули загружаются

### Рекомендуется (Recommended)
- [x] **HTTPS настроен** - см. [SSL_SETUP.md](SSL_SETUP.md)
- [x] **Дефолтные пароли изменены** - см. `.env.example`
- [x] **JWT_SECRET обновлен** - генерируйте: `openssl rand -base64 32`
- [x] **NGINX reverse proxy настроен** - см. [nginx/nginx.conf](nginx/nginx.conf)
- [x] **Резервное копирование БД** - см. [DATABASE_REPLICATION.md](DATABASE_REPLICATION.md)
- [x] **Monitoring включен** - см. [MONITORING.md](MONITORING.md)
- [x] **SSL сертификат установлен** - см. [SSL_SETUP.md](SSL_SETUP.md)
- [x] **Production build оптимизирован** - `npm run build`

### Опционально (Optional)
- [x] **CDN для статики** - CloudFlare, AWS CloudFront
- [x] **Redis кэширование** - см. [REDIS_SETUP.md](REDIS_SETUP.md)
- [x] **PM2 для управления** - см. [ecosystem.config.js](server/ecosystem.config.js)
- [x] **Docker контейнеры** - см. [DOCKER.md](DOCKER.md)
- [x] **CI/CD pipeline** - см. [.github/workflows/ci-cd.yml](.github/workflows/ci-cd.yml)
- [x] **Load balancer** - NGINX настроен
- [x] **Database replication** - см. [DATABASE_REPLICATION.md](DATABASE_REPLICATION.md)

---

## 📋 Пошаговая инструкция по развертыванию

### Шаг 1: Подготовка сервера

```bash
# Обновить систему
sudo apt update && sudo apt upgrade -y

# Установить необходимые пакеты
sudo apt install -y git nginx postgresql redis-server nodejs npm

# Установить Docker (опционально)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Установить Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### Шаг 2: Клонирование и настройка

```bash
# Клонировать проект
git clone <repository-url>
cd "1С бухгалтерия"

# Создать .env файлы
cp server/.env.example server/.env
nano server/.env  # Отредактировать настройки
```

### Шаг 3: База данных

```bash
# Создать БД
sudo -u postgres psql
CREATE DATABASE accounting_1c;
CREATE USER accounting_user WITH ENCRYPTED PASSWORD 'strong_password';
GRANT ALL PRIVILEGES ON DATABASE accounting_1c TO accounting_user;
\q

# Применить миграции
cd server
node src/scripts/run-migration.js
node src/scripts/add-universal-config.js
node src/scripts/set-universal-for-all.js
```

### Шаг 4: SSL сертификаты

```bash
# Let's Encrypt
sudo certbot certonly --standalone -d your-domain.com

# Или self-signed для тестирования
cd nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout privkey.pem -out fullchain.pem

# Скопировать сертификаты
sudo cp /etc/letsencrypt/live/your-domain.com/* nginx/ssl/
```

### Шаг 5: Docker развертывание (рекомендуется)

```bash
# Создать .env для Docker
cat > .env << EOF
DB_PASSWORD=your_secure_password
JWT_SECRET=$(openssl rand -base64 32)
EOF

# Запустить все сервисы
docker-compose up -d

# Проверить логи
docker-compose logs -f
```

### Шаг 6: Традиционное развертывание (без Docker)

```bash
# Backend
cd server
npm ci --production
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Frontend
cd ../client-accounting
npm ci
npm run build

# Копировать build в nginx
sudo cp -r dist/* /var/www/accounting/
```

### Шаг 7: NGINX конфигурация

```bash
# Скопировать конфиг
sudo cp nginx/nginx.conf /etc/nginx/sites-available/accounting
sudo ln -s /etc/nginx/sites-available/accounting /etc/nginx/sites-enabled/

# Тест конфигурации
sudo nginx -t

# Перезапустить NGINX
sudo systemctl restart nginx
```

### Шаг 8: Firewall

```bash
# Разрешить порты
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### Шаг 9: Мониторинг

```bash
# Sentry
export SENTRY_DSN='your_sentry_dsn'

# PM2 Monitoring
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M

# Логи
tail -f server/logs/combined.log
```

### Шаг 10: Backup

```bash
# Создать директорию backup
sudo mkdir -p /backup/accounting

# Добавить в crontab
sudo crontab -e

# Добавить строки:
0 2 * * * pg_dump -U accounting_user accounting_1c | gzip > /backup/accounting/db_$(date +\%Y\%m\%d).sql.gz
0 3 * * * find /backup/accounting -name "db_*.sql.gz" -mtime +30 -delete
```

---

## 🔍 Проверка развертывания

### Тест доступности

```bash
# Health check
curl http://localhost/api/health
curl https://your-domain.com/api/health

# Frontend
curl https://your-domain.com

# Backend API
curl https://your-domain.com/api/products
```

### Тест SSL

```bash
openssl s_client -connect your-domain.com:443 -servername your-domain.com
```

### Тест производительности

```bash
# Apache Bench
ab -n 1000 -c 10 https://your-domain.com/

# Siege
siege -c 10 -t 1M https://your-domain.com/api/products
```

---

## 📊 Мониторинг после развертывания

### 1. Проверить логи

```bash
# Docker
docker-compose logs -f backend

# PM2
pm2 logs

# NGINX
sudo tail -f /var/log/nginx/error.log
```

### 2. Проверить метрики

```bash
# PM2
pm2 monit

# Docker
docker stats
```

### 3. Проверить БД

```bash
psql -U accounting_user -d accounting_1c -c "SELECT COUNT(*) FROM users;"
```

---

## 🚨 Troubleshooting

### Backend не запускается

```bash
# Проверить логи
pm2 logs
docker-compose logs backend

# Проверить порт
sudo netstat -tulpn | grep 5000

# Проверить .env
cat server/.env
```

### Frontend не загружается

```bash
# Проверить NGINX
sudo nginx -t
sudo systemctl status nginx

# Проверить права
ls -la /var/www/accounting/

# Проверить логи
sudo tail -f /var/log/nginx/error.log
```

### БД не подключается

```bash
# Проверить PostgreSQL
sudo systemctl status postgresql

# Проверить подключение
psql -U accounting_user -d accounting_1c

# Проверить pg_hba.conf
sudo nano /etc/postgresql/14/main/pg_hba.conf
```

---

## 📚 Дополнительная документация

- [Docker Setup](DOCKER.md)
- [SSL Configuration](SSL_SETUP.md)
- [Redis Setup](REDIS_SETUP.md)
- [Database Replication](DATABASE_REPLICATION.md)
- [Monitoring](MONITORING.md)
- [CI/CD Pipeline](.github/workflows/ci-cd.yml)

---

## ✅ Финальная проверка

После выполнения всех шагов, убедитесь что:

- ✅ Сайт доступен по HTTPS
- ✅ SSL сертификат валиден
- ✅ API endpoints отвечают
- ✅ Логин работает
- ✅ Все модули загружаются
- ✅ Monitoring активен
- ✅ Backup настроен
- ✅ Логи пишутся
- ✅ Performance удовлетворительный

**Поздравляем! Ваше приложение готово к production! 🎉**
