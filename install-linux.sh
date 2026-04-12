#!/bin/bash

# ============================================
# SmartPOS Pro — Скрипт автоустановки
# Для Linux (Ubuntu/Debian)
# ============================================

set -e

echo "================================================"
echo "  SmartPOS Pro — Автоматическая установка"
echo "================================================"
echo ""

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Проверка root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Ошибка: Запустите скрипт с правами root (sudo)${NC}"
    exit 1
fi

# Переменные
INSTALL_DIR="/opt/smartpos"
DB_NAME="smartpos_pro"
DB_USER="smartpos"
DB_PASS=$(openssl rand -base64 12)
JWT_SECRET=$(openssl rand -base64 32)

echo -e "${YELLOW}[1/8] Обновление системы...${NC}"
apt update && apt upgrade -y

echo -e "${YELLOW}[2/8] Установка Node.js 18...${NC}"
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

echo -e "${YELLOW}[3/8] Установка PostgreSQL...${NC}"
apt install -y postgresql postgresql-contrib
systemctl start postgresql
systemctl enable postgresql

echo -e "${YELLOW}[4/8] Создание базы данных...${NC}"
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

echo -e "${YELLOW}[5/8] Установка Redis...${NC}"
apt install -y redis-server
systemctl start redis
systemctl enable redis

echo -e "${YELLOW}[6/8] Копирование файлов сервера...${NC}"
mkdir -p $INSTALL_DIR
cp -r ./server/* $INSTALL_DIR/
cd $INSTALL_DIR

echo -e "${YELLOW}[7/8] Настройка переменных окружения...${NC}"
cat > $INSTALL_DIR/.env << EOF
# SmartPOS Pro Configuration
NODE_ENV=production
PORT=5000

# Database
DATABASE_URL=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME

# JWT
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d

# Redis
REDIS_URL=redis://localhost:6379

# Logging
LOG_LEVEL=info
EOF

echo -e "${YELLOW}[8/8] Установка зависимостей и запуск...${NC}"
cd $INSTALL_DIR
npm install --production

# Создание systemd сервиса
cat > /etc/systemd/system/smartpos.service << EOF
[Unit]
Description=SmartPOS Pro Server
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable smartpos
systemctl start smartpos

echo ""
echo "================================================"
echo -e "${GREEN}  ✅ Установка завершена успешно!${NC}"
echo "================================================"
echo ""
echo "Информация о подключении:"
echo "-------------------------------------------"
echo -e "Адрес сервера: ${GREEN}http://$(hostname -I | awk '{print $1}'):5000${NC}"
echo -e "База данных:   ${GREEN}$DB_NAME${NC}"
echo -e "Пользователь:  ${GREEN}$DB_USER${NC}"
echo -e "Пароль БД:     ${GREEN}$DB_PASS${NC}"
echo ""
echo -e "${YELLOW}ВАЖНО: Сохраните эти данные!${NC}"
echo ""
echo "Для проверки статуса:"
echo "  systemctl status smartpos"
echo ""
echo "Для просмотра логов:"
echo "  journalctl -u smartpos -f"
echo ""
