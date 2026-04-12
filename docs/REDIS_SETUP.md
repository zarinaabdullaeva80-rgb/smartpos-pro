# Redis Configuration для 1С Бухгалтерия

## Установка Redis

### Windows
```bash
# Скачать Redis для Windows
# https://github.com/microsoftarchive/redis/releases

# Или использовать Docker
docker run -d -p 6379:6379 --name redis redis:7-alpine
```

### Linux
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis
sudo systemctl enable redis
```

## redis.conf

```conf
# Network
bind 127.0.0.1 ::1
port 6379
timeout 300
tcp-keepalive 60

# General
daemonize no
supervised systemd
pidfile /var/run/redis/redis-server.pid
loglevel notice
logfile /var/log/redis/redis-server.log

# Persistence
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
dir /var/lib/redis

# Replication
replica-serve-stale-data yes
replica-read-only yes

# Security
requirepass your_secure_redis_password

# Memory Management
maxmemory 256mb
maxmemory-policy allkeys-lru

# Performance
slowlog-log-slower-than 10000
slowlog-max-len 128
```

## Использование в приложении

### Backend интеграция

```javascript
// server/src/utils/redis.js
import Redis from 'ioredis';

const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD,
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    }
});

redis.on('connect', () => {
    console.log('✓ Redis connected');
});

redis.on('error', (err) => {
    console.error('✗ Redis error:', err);
});

export default redis;
```

### Кэширование

```javascript
// Пример кэширования товаров
import redis from './utils/redis.js';

// Get products with cache
export async function getProducts(req, res) {
    try {
        // Check cache
        const cachedProducts = await redis.get('products:all');
        
        if (cachedProducts) {
            return res.json(JSON.parse(cachedProducts));
        }
        
        // Fetch from database
        const result = await pool.query('SELECT * FROM products');
        const products = result.rows;
        
        // Save to cache (1 hour)
        await redis.setex('products:all', 3600, JSON.stringify(products));
        
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

// Invalidate cache on update
export async function updateProduct(req, res) {
    try {
        // Update database
        await pool.query('UPDATE products SET ... WHERE id = $1', [id]);
        
        // Invalidate cache
        await redis.del('products:all');
        await redis.del(`product:${id}`);
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
```

## Мониторинг

```bash
# Проверка статуса
redis-cli ping

# Просмотр статистики
redis-cli info

# Мониторинг команд в реальном времени
redis-cli monitor

# Просмотр занятой памяти
redis-cli info memory
```
