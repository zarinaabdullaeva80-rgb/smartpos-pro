# Быстрый старт: настройка ngrok для удаленного доступа

## Что уже сделано автоматически ✅

1. ✅ Сервер настроен для приема внешних подключений (`SERVER_HOST=0.0.0.0`)
2. ✅ Создан скрипт автоматизации `scripts/start-ngrok.ps1`
3. ✅ Создан шаблон конфигурации `client-accounting/.env.local.template`
4. ✅ Обновлена документация `NGROK_SETUP.md`

## Что нужно сделать вручную 📝

### 1. Установите authtoken

Откройте PowerShell и выполните:

```powershell
ngrok config add-authtoken ВАШ_AUTHTOKEN
```

> Замените `ВАШ_AUTHTOKEN` на реальный токен из ngrok dashboard

### 2. Запустите ngrok туннель

Есть два способа:

**Способ А: Используя скрипт (рекомендуется)**
```powershell
cd "c:\Users\user\Desktop\1С бухгалтерия"
.\scripts\start-ngrok.ps1
```

**Способ Б: Вручную**
```powershell
ngrok http 5000
```

### 3. Скопируйте Forwarding URL

После запуска ngrok вы увидите что-то вроде:
```
Forwarding   https://abc-123-def.ngrok-free.app -> http://localhost:5000
```

**Скопируйте этот URL** (например: `https://abc-123-def.ngrok-free.app`)

### 4. Обновите CORS в сервере

Откройте файл `server\.env` и обновите строку `CORS_ORIGIN`:

```bash
CORS_ORIGIN=http://localhost:3000,http://localhost:3001,https://abc-123-def.ngrok-free.app
```

> Замените `https://abc-123-def.ngrok-free.app` на ваш реальный URL!

### 5. Перезапустите сервер

В терминале с запущенным сервером:
1. Нажмите `Ctrl+C` для остановки
2. Запустите снова:
```powershell
npm run dev
```

### 6. Настройте клиент (для удаленного доступа)

Создайте файл `client-accounting\.env.local`:

```bash
VITE_API_URL=https://abc-123-def.ngrok-free.app/api
VITE_SOCKET_URL=https://abc-123-def.ngrok-free.app
```

> Замените `https://abc-123-def.ngrok-free.app` на ваш реальный URL!

### 7. Перезапустите клиент

В терминале с запущенным клиентом:
1. Нажмите `Ctrl+C` для остановки
2. Запустите снова:
```powershell
npm run dev
```

## ✨ Готово!

Теперь можно подключаться к приложению:

- **Локально**: `http://localhost:3000`
- **Удаленно (с любого устройства)**: `https://abc-123-def.ngrok-free.app`

## ⚠️ Важные замечания

- URL меняется при каждом перезапуске ngrok (для статического URL нужна платная подписка)
- Не забывайте обновлять CORS_ORIGIN в `server\.env` при каждом изменении URL
- Для постоянной работы держите ngrok запущенным в отдельном терминале

## 🔍 Проверка

Откройте ngrok URL в браузере. Если видите интерфейс 1С Бухгалтерия - всё работает! 🎉

## 📱 Доступ с телефона

1. Убедитесь, что телефон подключен к мобильному интернету (не к той же WiFi сети!)
2. Откройте ngrok URL в браузере телефона
3. Войдите в систему

---

Если что-то не работает, смотрите подробную инструкцию в `NGROK_SETUP.md`
