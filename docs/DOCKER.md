# Docker для 1С Бухгалтерия

## Структура контейнеров

```
┌─────────────────────────────────────────┐
│           Docker Compose                │
├───────────┬───────────┬─────────────────┤
│   nginx   │  backend  │  frontend       │
│   :80     │   :5000   │   :3000         │
├───────────┼───────────┼─────────────────┤
│           │ postgres  │  redis          │
│           │   :5432   │   :6379         │
└───────────┴───────────┴─────────────────┘
```

## docker-compose.yml

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:14
    container_name: accounting_db
    restart: always
    environment:
      POSTGRES_DB: accounting_1c
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql
      - ./database/migrations:/docker-entrypoint-initdb.d/migrations
    ports:
      - "5432:5432"
    networks:
      - accounting_network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis Cache
  redis:
    image: redis:7-alpine
    container_name: accounting_redis
    restart: always
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - accounting_network
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  # Backend API
  backend:
    build:
      context: ./server
      dockerfile: Dockerfile
    container_name: accounting_backend
    restart: always
    environment:
      NODE_ENV: production
      PORT: 5000
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: accounting_1c
      DB_USER: postgres
      DB_PASSWORD: ${DB_PASSWORD}
      REDIS_HOST: redis
      REDIS_PORT: 6379
      JWT_SECRET: ${JWT_SECRET}
      GOOGLE_SPREADSHEET_ID: ${GOOGLE_SPREADSHEET_ID}
      GOOGLE_SERVICE_ACCOUNT_KEY_FILE: /app/credentials/google-credentials.json
    volumes:
      - ./server/credentials:/app/credentials
    ports:
      - "5000:5000"
    networks:
      - accounting_network
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Frontend (для production билда)
  frontend:
    build:
      context: ./client-accounting
      dockerfile: Dockerfile
    container_name: accounting_frontend
    restart: always
    ports:
      - "3000:80"
    networks:
      - accounting_network
    depends_on:
      - backend

  # NGINX Reverse Proxy
  nginx:
    image: nginx:alpine
    container_name: accounting_nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
      - ./nginx/conf.d:/etc/nginx/conf.d
    networks:
      - accounting_network
    depends_on:
      - backend
      - frontend
    healthcheck:
      test: ["CMD", "nginx", "-t"]
      interval: 30s
      timeout: 3s
      retries: 3

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local

networks:
  accounting_network:
    driver: bridge
```

## .env файл для Docker

```env
# Database
DB_PASSWORD=your_secure_password

# JWT
JWT_SECRET=your_super_secret_jwt_key_change_this

# Google Sheets (опционально)
GOOGLE_SPREADSHEET_ID=your_spreadsheet_id
```

## Запуск

```bash
# Запустить все сервисы
docker-compose up -d

# Просмотр логов
docker-compose logs -f

# Остановить сервисы
docker-compose down

# Пересборка
docker-compose up -d --build
```
