# SmartPOS Pro — Руководство по развёртыванию для клиентов

## 📋 Содержание

1. [Требования](#требования)
2. [Быстрая установка (Docker)](#быстрая-установка-docker)
3. [Ручная установка](#ручная-установка)
4. [Настройка лицензии](#настройка-лицензии)
5. [Первый вход](#первый-вход)
6. [Подключение мобильного приложения](#подключение-мобильного-приложения)

---

## 🖥️ Требования

### Минимальные требования к серверу

| Компонент | Требование |
|-----------|------------|
| **ОС** | Windows 10+, Ubuntu 20.04+, macOS |
| **CPU** | 2 ядра |
| **RAM** | 4 GB |
| **Диск** | 20 GB SSD |
| **Сеть** | Статический IP (рекомендуется) |

### Программное обеспечение

- **Node.js** 18+ ([nodejs.org](https://nodejs.org))
- **PostgreSQL** 14+ ([postgresql.org](https://postgresql.org))
- **Redis** 6+ (опционально, для кэширования)

---

## 🐳 Быстрая установка (Docker)

### 1. Установите Docker

**Windows:**

```
Скачайте Docker Desktop: https://docker.com/products/docker-desktop
```

**Linux:**

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

### 2. Скачайте файлы проекта

Распакуйте архив `smartpos-pro-server.zip` в папку на сервере.

### 3. Настройте переменные окружения

Скопируйте `.env.example` в `.env` и отредактируйте:

```bash
cp .env.example .env
```

Основные настройки:

```env
# База данных
DATABASE_URL=postgresql://postgres:password@db:5432/smartpos

# JWT ключ (сгенерируйте свой!)
JWT_SECRET=your-super-secret-key-change-me

# Сервер
PORT=5000
NODE_ENV=production

# Ваш лицензионный ключ (получите от поставщика)
LICENSE_KEY=XXXX-XXXX-XXXX-XXXX
```

### 4. Запустите систему

```bash
docker-compose up -d
```

### 5. Проверьте статус

```bash
docker-compose ps
docker-compose logs -f server
```

**Готово!** Сервер доступен по адресу: `http://ваш-ip:5000`

---

## 🔧 Ручная установка

### 1. Установите PostgreSQL

**Windows:** Скачайте с <https://postgresql.org/download/windows/>

**Linux:**

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2. Создайте базу данных

```bash
sudo -u postgres psql

CREATE DATABASE smartpos_pro;
CREATE USER smartpos WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE smartpos_pro TO smartpos;
\q
```

### 3. Установите Node.js

```bash
# Linux (Ubuntu)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Windows - скачайте с nodejs.org
```

### 4. Настройте сервер

```bash
cd server
cp .env.example .env
# Отредактируйте .env
nano .env
```

### 5. Установите зависимости

```bash
npm install
```

### 6. Примените миграции

```bash
npm run migrate
```

### 7. Запустите сервер

```bash
# Для разработки
npm run dev

# Для продакшена
npm start
```

### 8. Настройте автозапуск (Linux)

```bash
sudo nano /etc/systemd/system/smartpos.service
```

```ini
[Unit]
Description=SmartPOS Pro Server
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/smartpos/server
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable smartpos
sudo systemctl start smartpos
```

---

## 🔑 Настройка лицензии

### Активация лицензии

При первом запуске система запросит лицензионный ключ. Введите ключ, полученный при покупке:

```
Формат: XXXX-XXXX-XXXX-XXXX
```

### Привязка к серверу

Лицензия автоматически привязывается к вашему серверу. При смене сервера обратитесь в поддержку.

---

## 👤 Первый вход

### Учётные данные администратора

После активации лицензии используйте:

| Поле | Значение |
|------|----------|
| **Логин** | Ваш логин из лицензии |
| **Пароль** | Ваш пароль из лицензии |

### Создание сотрудников

После входа администратор может создавать пользователей:

1. Перейдите в **Настройки** → **Сотрудники**
2. Нажмите **Добавить сотрудника**
3. Укажите логин, пароль и роль

---

## 📱 Подключение мобильного приложения

### 1. Установите приложение

Скачайте APK файл `SmartPOS-Mobile.apk` и установите на устройство.

### 2. Настройте подключение

При первом запуске укажите адрес сервера:

```
http://IP-ВАШЕГО-СЕРВЕРА:5000
```

**Пример:** `http://192.168.1.100:5000`

### 3. Войдите в систему

Используйте логин и пароль сотрудника, созданного в веб-панели.

### 4. Проверка соединения

- ✅ Зелёный индикатор = подключено
- ⚠️ Жёлтый = офлайн режим
- ❌ Красный = нет соединения

---

## 🌐 Настройка доступа из интернета

### Вариант 1: Статический IP

Если у вас статический IP, просто откройте порт 5000 на роутере.

### Вариант 2: Ngrok (временный доступ)

```bash
ngrok http 5000
```

### Вариант 3: Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name pos.vasha-kompaniya.uz;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}
```

---

## 🆘 Техническая поддержка

**Email:** <support@smartpos.uz>  
**Телефон:** +998 XX XXX XX XX  
**Telegram:** @smartpos_support

---

**Версия документа:** 1.0  
**Дата:** Февраль 2026
