# Проверка конфигурации для мобильного доступа

## 1. Backend Server

### Проверить CORS настройки:
Файл: `server/src/index.js`
```javascript
app.use(cors({
    origin: '*', // Разрешить все источники
    credentials: true
}));
```

### Проверить IP адрес сервера:
```bash
ipconfig
# Найти IPv4 адрес (например: 192.168.1.100)
```

## 2. Desktop приложение

### Файл: `client-accounting/.env`
```env
REACT_APP_API_URL=http://localhost:5000
```

Для удалённого доступа заменить на:
```env
REACT_APP_API_URL=http://192.168.1.100:5000
```

## 3. Admin Panel

### Файл: `client-admin/.env`
```env
REACT_APP_API_URL=http://localhost:5000
```

## 4. Mobile POS

### Файл: `mobile-pos/src/services/api.js`
Проверить базовый URL:
```javascript
const API_URL = 'http://192.168.1.100:5000';
```

## Шаги для настройки мобильного доступа:

### Вариант 1: Локальная сеть (WiFi)
1. Узнать IP компьютера: `ipconfig`
2. Обновить API_URL во всех клиентах
3. Убедиться что firewall разрешает порт 5000
4. Подключить телефон к той же WiFi сети

### Вариант 2: Ngrok (через интернет)
1. Установить ngrok: `npm install -g ngrok`
2. Запустить: `ngrok http 5000`
3. Скопировать URL (например: https://abc123.ngrok.io)
4. Обновить API_URL во всех клиентах

## Команды для запуска всех систем:

```bash
# Terminal 1: Backend
cd server
npm start

# Terminal 2: Desktop
cd client-accounting
npm start

# Terminal 3: Admin Panel  
cd client-admin
npm start

# Terminal 4: Mobile
cd mobile-pos
npx expo start
```

## Проверка подключения:

### Проверить сервер работает:
```bash
curl http://localhost:5000/api/health
```

### Проверить с мобильного:
Открыть в браузере телефона:
```
http://192.168.1.100:5000/api/health
```

Если видите ответ - всё работает!
