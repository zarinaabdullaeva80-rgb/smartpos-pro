# Инструкции по настройке интеграций

## 1. ✅ Redis (ИСПРАВЛЕНО)

Redis отключен в `.env`:
```
ENABLE_REDIS_CACHE=false
```

Если нужно включить Redis:
1. Установить Redis: https://redis.io/download
2. Запустить: `redis-server`
3. В `.env` установить: `ENABLE_REDIS_CACHE=true`

---

## 2. 📧 Настройка SMTP (Email)

### Gmail

1. Включите 2FA в Google аккаунте
2. Создайте App Password: https://myaccount.google.com/apppasswords
3. Обновите `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=xxxx-xxxx-xxxx-xxxx
SMTP_FROM="1C Accounting <your-email@gmail.com>"
```

### Yandex

```env
SMTP_HOST=smtp.yandex.ru
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@yandex.ru
SMTP_PASSWORD=your-password
```

### Mail.ru

```env
SMTP_HOST=smtp.mail.ru
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@mail.ru
SMTP_PASSWORD=your-password
```

---

## 3. 🤖 Настройка Telegram Bot

### Шаг 1: Создание бота

1. Откройте Telegram, найдите @BotFather
2. Отправьте `/newbot`
3. Введите имя бота: `1C Accounting Alerts`
4. Введите username: `my_1c_accounting_bot` (уникальный)
5. Скопируйте токен

### Шаг 2: Получение Chat ID

1. Добавьте бота в группу или напишите ему лично
2. Откройте: `https://api.telegram.org/bot<TOKEN>/getUpdates`
3. Найдите `"chat":{"id": XXXXXXXXX}` - это ваш Chat ID

### Шаг 3: Обновите .env

```env
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_ADMIN_CHAT_ID=123456789
ENABLE_TELEGRAM_BOT=true
```

---

## 4. 📱 Mobile POS - Исправление ошибок

### Проблема: Boolean cast error

Эта ошибка связана с несовместимостью версий React Native Paper и Expo SDK 54.

### Решение 1: Переустановка зависимостей

```bash
cd mobile-pos
rm -rf node_modules
npm install
npx expo start -c
```

### Решение 2: Даунгрейд Expo (если проблема сохраняется)

```bash
npx expo install expo@51
npx expo install --fix
```

### Решение 3: Обновление Metro config

Создайте `metro.config.js`:
```javascript
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.sourceExts = ['jsx', 'js', 'ts', 'tsx', 'json'];

module.exports = config;
```

---

## После настройки

Перезапустите сервер:

```powershell
# Остановить текущий
Ctrl+C

# Запустить снова
cd "C:\Users\user\Desktop\1С бухгалтерия\server"
npm run dev
```

Проверьте логи - ошибки Redis должны исчезнуть.
