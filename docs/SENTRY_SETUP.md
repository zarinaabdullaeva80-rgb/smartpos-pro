# Sentry Error Monitoring Setup

## Установка

```bash
npm install @sentry/node @sentry/profiling-node --save
```

---

##Server Integration

### 1. Создать файл конфигурации

**server/src/config/sentry.js**
```javascript
import * as Sentry from "@sentry/node";
import { ProfilingIntegration } from "@sentry/profiling-node";

export function initSentry(app) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        
        // Performance Monitoring
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
        
        // Profiling
        profilesSampleRate: 1.0,
        
        integrations: [
            new ProfilingIntegration(),
            new Sentry.Integrations.Http({ tracing: true }),
            new Sentry.Integrations.Express({ app }),
        ],
        
        // Игнорировать определённые ошибки
        ignoreErrors: [
            'ECONNREFUSED',
            'ENOTFOUND',
            'SequelizeConnectionError',
        ],
        
        beforeSend(event, hint) {
            // Фильтровать чувствительные данные
            if (event.request) {
                delete event.request.cookies;
                delete event.request.headers?.authorization;
            }
            return event;
        }
    });
    
    // Request handler должен быть первым middleware
    app.use(Sentry.Handlers.requestHandler());
    
    // Tracing handler
    app.use(Sentry.Handlers.tracingHandler());
}

export function sentryErrorHandler(app) {
    // Error handler должен быть ПОСЛЕ всех роутов
    app.use(Sentry.Handlers.errorHandler());
}

export default Sentry;
```

### 2. Обновить server/src/index.js

```javascript
import { initSentry, sentryErrorHandler } from './config/sentry.js';

const app = express();

// ПЕРВОЕ: Инициализация Sentry
initSentry(app);

// ... остальные middleware и роуты ...

// ПОСЛЕДНЕЕ: Error handler Sentry (перед вашим error handler)
sentryErrorHandler(app);

// Ваш error handler
app.use((err, req, res, next) => {
    // Sentry уже залогировал ошибку
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
});
```

---

## Frontend Integration

### React

```bash
npm install @sentry/react
```

**client-accounting/src/index.jsx**
```javascript
import * as Sentry from "@sentry/react";

Sentry.init({
    dsn: process.env.REACT_APP_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    integrations: [
        new Sentry.BrowserTracing(),
        new Sentry.Replay(),
    ],
    
    // Performance
    tracesSampleRate: 0.1,
    
    // Session Replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
});

// ErrorBoundary
function App() {
    return (
        <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
            <YourApp />
        </Sentry.ErrorBoundary>
    );
}
```

---

## Usage Examples

### Захват ошибок вручную
```javascript
import Sentry from './config/sentry.js';

try {
    // Опасный код
    riskyOperation();
} catch (error) {
    Sentry.captureException(error, {
        tags: {
            section: 'sales',
            action: 'create_sale'
        },
        extra: {
            userId: req.user.userId,
            data: req.body
        }
    });
    
    // Продолжить обработку
    res.status(500).json({ error: 'Failed to create sale' });
}
```

### Breadcrumbs (хлебные крошки)
```javascript
Sentry.addBreadcrumb({
    category: 'api',
    message: 'User attempting to create sale',
    level: 'info',
    data: { userId: req.user.userId }
});
```

### Установка контекста пользователя
```javascript
// В middleware auth
Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.full_name
});

// Очистить при logout
Sentry.setUser(null);
```

### Performance Monitoring
```javascript
const transaction = Sentry.startTransaction({
    op: 'database.query',
    name: 'Complex ABC Analysis'
});

try {
    const result = await pool.query(/* complex query */);
    transaction.setStatus('ok');
} catch (error) {
    transaction.setStatus('internal_error');
    throw error;
} finally {
    transaction.finish();
}
```

---

## Environment Variables

**.env**
```env
# Получить DSN на https://sentry.io
SENTRY_DSN=https://your-key@o123456.ingest.sentry.io/7654321
NODE_ENV=production
```

**client-accounting/.env**
```env
REACT_APP_SENTRY_DSN=https://your-frontend-key@o123456.ingest.sentry.io/7654322
```

---

## Настройка на sentry.io

1. Создать аккаунт: https://sentry.io
2. Создать 2 проекта:
   - `1c-accounting-backend` (Node.js)
   - `1c-accounting-frontend` (React)
3. Скопировать DSN для каждого проекта
4. Настроить Alerts (email/Slack при ошибках)

---

## Source Maps (для production)

### Backend
```javascript
// Добавить в Sentry.init
Sentry.init({
    // ...
    release: process.env.npm_package_version,
    dist: process.env.BUILD_NUMBER
});
```

### Frontend (Create React App)
```bash
# package.json
{
    "scripts": {
        "build": "react-scripts build && sentry-cli sourcemaps upload --org your-org --project your-project ./build"
    }
}
```

---

## Health Check Endpoint

```javascript
// server/src/routes/health.js
router.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        sentryConfigured: !!process.env.SENTRY_DSN
    });
});
```

---

## Текущее состояние

Sentry **не установлен** (опционально).

Для добавления:
1. `npm install @sentry/node @sentry/profiling-node`
2. Создать аккаунт на sentry.io
3. Добавить DSN в .env
4. Раскомментировать код выше
