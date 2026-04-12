# Мониторинг приложения

## Sentry Setup

### 1. Регистрация в Sentry

1. Перейти на https://sentry.io
2. Создать аккаунт
3. Создать новый проект (Node.js для backend, JavaScript для frontend)
4. Получить DSN ключ

### 2. Backend интеграция

#### Установка

```bash
cd server
npm install @sentry/node @sentry/tracing
```

#### Конфигурация (server/src/sentry.js)

```javascript
import * as Sentry from '@sentry/node';
import * as Tracing from '@sentry/tracing';
import express from 'express';

export function initSentry(app) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: 1.0,
        integrations: [
            new Sentry.Integrations.Http({ tracing: true }),
            new Tracing.Integrations.Express({ app }),
        ],
    });

    // Request handler должен быть первым middleware
    app.use(Sentry.Handlers.requestHandler());
    app.use(Sentry.Handlers.tracingHandler());
}

export function sentryErrorHandler() {
    return Sentry.Handlers.errorHandler();
}

export default Sentry;
```

#### Использование в index.js

```javascript
import { initSentry, sentryErrorHandler } from './sentry.js';

const app = express();

// Инициализация Sentry (первым!)
initSentry(app);

// ... остальные middleware ...

// Error handler Sentry (перед обычным error handler)
app.use(sentryErrorHandler());

// Обычный error handler
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
});
```

### 3. Frontend интеграция

#### Установка

```bash
cd client-accounting
npm install @sentry/react @sentry/tracing
```

#### Конфигурация (main.jsx)

```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';
import App from './App';

Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [new BrowserTracing()],
    tracesSampleRate: 1.0,
});

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
            <App />
        </Sentry.ErrorBoundary>
    </React.StrictMode>
);
```

## PM2 Monitoring

### PM2 Plus (бесплатный мониторинг)

```bash
# Регистрация
pm2 plus

# Линк приложения
pm2 link <secret_key> <public_key>

# Мониторинг
pm2 monitor
```

### Просмотр метрик

```bash
# Мониторинг в реальном времени
pm2 monit

# Логи
pm2 logs

# Статус
pm2 status

# Детальная информация
pm2 show 1c-accounting-backend
```

## Prometheus + Grafana

### docker-compose добавление

```yaml
  prometheus:
    image: prom/prometheus
    container_name: prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
    networks:
      - accounting_network

  grafana:
    image: grafana/grafana
    container_name: grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
    networks:
      - accounting_network
    depends_on:
      - prometheus

volumes:
  prometheus_data:
  grafana_data:
```

### Prometheus конфигурация

```yaml
# prometheus/prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'accounting-backend'
    static_configs:
      - targets: ['backend:5000']

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']
```

## Логирование

### Winston setup (backend)

```bash
npm install winston winston-daily-rotate-file
```

```javascript
// server/src/utils/logger.js
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    transports: [
        new DailyRotateFile({
            filename: 'logs/error-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            level: 'error',
            maxFiles: '30d'
        }),
        new DailyRotateFile({
            filename: 'logs/combined-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            maxFiles: '30d'
        }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

export default logger;
```

## Health Checks

### Backend endpoint

```javascript
// server/src/routes/health.js
import express from 'express';
import { pool } from '../db.js';
import redis from '../utils/redis.js';

const router = express.Router();

router.get('/health', async (req, res) => {
    const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks: {}
    };

    // Database check
    try {
        await pool.query('SELECT 1');
        health.checks.database = 'healthy';
    } catch (error) {
        health.checks.database = 'unhealthy';
        health.status = 'degraded';
    }

    // Redis check
    try {
        await redis.ping();
        health.checks.redis = 'healthy';
    } catch (error) {
        health.checks.redis = 'unhealthy';
    }

    const statusCode = health.status === 'ok' ? 200 : 503;
    res.status(statusCode).json(health);
});

export default router;
```

## Alerts

### Email уведомления при ошибках

```javascript
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
    }
});

export async function sendErrorAlert(error, context) {
    await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: process.env.ADMIN_EMAIL,
        subject: `[1C Accounting] Error Alert`,
        text: `Error: ${error.message}\n\nContext: ${JSON.stringify(context, null, 2)}`
    });
}
```

## Uptime Monitoring

### UptimeRobot

1. Зарегистрироваться на https://uptimerobot.com
2. Добавить мониторы:
   - HTTP(s): https://your-domain.com
   - Port: 5000 (backend)
   - Keyword: проверка наличия текста на странице

### Настройка оповещений

- Email
- SMS
- Webhook
- Telegram
- Slack
