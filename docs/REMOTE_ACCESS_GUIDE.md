# Удаленный доступ к системе 1С через интернет

Руководство по настройке доступа к системе 1С через интернет (включая мобильный интернет).

## Содержание
1. [Быстрый старт с ngrok](#быстрый-старт-с-ngrok)
2. [Настройка для локальной сети](#локальная-сеть)
3. [Облачное развертывание](#облачное-развертывание)
4. [Безопасность](#безопасность)

---

## Быстрый старт с ngrok

**ngrok** - самый быстрый способ получить доступ через интернет.

### Шаг 1: Установка ngrok
1. Скачайте ngrok: https://ngrok.com/download
2. Распакуйте в любую папку
3. Зарегистрируйтесь и получите токен

### Шаг 2: Запуск сервера
```bash
# В папке server
cd server
npm run dev
```

### Шаг 3: Создание туннеля ngrok
```bash
# В новом окне терминала
ngrok http 5000
```

Вы увидите:
```
Forwarding  https://abc123.ngrok.io -> http://localhost:5000
```

### Шаг 4: Настройка клиента
Создайте файл `client-accounting\.env.local`:
```
VITE_API_URL=https://abc123.ngrok.io/api
VITE_SOCKET_URL=https://abc123.ngrok.io
```

### Шаг 5: Запуск клиента
```bash
cd client-accounting
npm run dev
```

✅ Теперь можно подключаться через `https://abc123.ngrok.io`!

---

## Локальная сеть (WiFi)

Для доступа в пределах одной сети (офис, дом).

### Шаг 1: Узнайте ваш IP-адрес
```bash
# Windows
ipconfig

# Найдите IPv4-адрес (например: 192.168.1.100)
```

### Шаг 2: Настройте сервер
В файле `server\.env` измените:
```bash
SERVER_HOST=0.0.0.0  # Слушать на всех интерфейсах
CORS_ORIGIN=http://localhost:3000,http://192.168.1.100:3000
```

### Шаг 3: Откройте порт в файерволе Windows
```bash
# PowerShell (от администратора)
New-NetFirewallRule -DisplayName "1C Server" -Direction Inbound -Protocol TCP -LocalPort 5000 -Action Allow
```

### Шаг 4: Подключение с других устройств
На телефоне/планшете откройте:
```
http://192.168.1.100:3000
```

---

## Облачное развертывание

Для постоянного доступа через интернет.

### Вариант 1: Heroku (Бесплатно / Платно)

#### 1. Установите Heroku CLI
```bash
# Скачайте с: https://devcenter.heroku.com/articles/heroku-cli
```

#### 2. Подготовка приложения
```bash
cd server
heroku login
heroku create my-1c-app
```

#### 3. Настройка PostgreSQL
```bash
heroku addons:create heroku-postgresql:mini
```

#### 4. Установите переменные
```bash
heroku config:set JWT_SECRET=your_secret_key
heroku config:set SERVER_HOST=0.0.0.0
```

#### 5. Деплой
```bash
git add .
git commit -m "Deploy to Heroku"
git push heroku main
```

### Вариант 2: DigitalOcean App Platform

1. Создайте аккаунт на DigitalOcean
2. Создайте новый App
3. Подключите GitHub репозиторий
4. Настройте environment variables
5. Deploy!

### Вариант 3: AWS EC2 (Полный контроль)

Подробная инструкция по запросу.

---

## Безопасность

### Обязательные меры:

1. **Используйте HTTPS**
   ```bash
   # ngrok автоматически даёт HTTPS
   # Для production используйте Let's Encrypt
   ```

2. **Сильный JWT Secret**
   ```bash
   # В .env
   JWT_SECRET=ВАША_ОЧЕНЬ_ДЛИННАЯ_СЛУЧАЙНАЯ_СТРОКА
   ```

3. **Настройте CORS правильно**
   ```bash
   # Только разрешенные домены
   CORS_ORIGIN=https://yourdomain.com,https://yourapp.ngrok.io
   ```

4. **Ограничьте доступ к базе**
   - Используйте сильный пароль PostgreSQL
   - Разрешите подключения только от сервера

5. **Регулярные обновления**
   ```bash
   npm update
   ```

---

## Troubleshooting

### Не могу подключиться из локальной сети
- ✅ Проверьте файервол Windows
- ✅ Убедитесь что SERVER_HOST=0.0.0.0
- ✅ Проверьте IP командой `ipconfig`

### ngrok туннель не работает
- ✅ Убедитесь что сервер запущен на порту 5000
- ✅ Проверьте не истёк ли токен ngrok
- ✅ Бесплатная версия закрывает туннель при бездействии

### CORS ошибки
- ✅ Добавьте URL в CORS_ORIGIN
- ✅ Перезапустите сервер после изменения .env

---

## Скрипты-помощники

### start-remote.bat
```batch
@echo off
echo ====================================
echo Запуск 1С с удаленным доступом
echo ====================================
echo.
echo 1. Запуск сервера...
cd server
start cmd /k "npm run dev"
timeout /t 3

echo 2. Запуск ngrok...
start cmd /k "ngrok http 5000"
timeout /t 5

echo 3. Запуск клиента...
cd ..\client-accounting
start cmd /k "npm run dev"

echo.
echo ====================================
echo Все компоненты запущены!
echo Проверьте консоль ngrok для URL
echo ====================================
pause
```

---

## Поддержка

Если возникли проблемы:
1. Проверьте логи сервера
2. Проверьте консоль браузера (F12)
3. Убедитесь что все порты открыты

**Готово!** Теперь ваша система 1С доступна из любой точки мира! 🌍
