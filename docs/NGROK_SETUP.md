# Пошаговая настройка ngrok

## Шаг 1: Регистрация и получение токена

1. **Откройте в браузере:** https://dashboard.ngrok.com/signup
2. **Зарегистрируйтесь** (можно через Google/GitHub)
3. **После регистрации откроется дашборд**
4. **Скопируйте ваш Authtoken** (будет виден сразу на главной странице)

Authtoken выглядит примерно так:
```
2abc123def456ghi789jkl012mno345pqr_678stuv901wxyz234ABC567DEF890
```

## Шаг 2: Установка authtoken

Откройте PowerShell или CMD и выполните:

```bash
ngrok config add-authtoken ВАШ_AUTHTOKEN
```

Пример:
```bash
ngrok config add-authtoken 2abc123def456ghi789jkl012mno345pqr_678stuv901wxyz234ABC567DEF890
```

Вы увидите:
```
Authtoken saved to configuration file: C:\Users\[ваш-пользователь]\.ngrok2\ngrok.yml
```

## Шаг 3: Запуск туннеля

После установки authtoken, выполните:

```bash
ngrok http 5000
```

Вы увидите что-то вроде этого:
```
Session Status                online
Account                       Your Name (Plan: Free)
Version                       3.x.x
Region                        United States (us)
Latency                       45ms
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc-123-def.ngrok-free.app -> http://localhost:5000

Connections                   ttl     opn     rt1     rt5     p50     p90
                              0       0       0.00    0.00    0.00    0.00
```

## Шаг 4: Скопируйте URL

Найдите строку **Forwarding** и скопируйте URL (например):
```
https://abc-123-def.ngrok-free.app
```

## Шаг 5: Настройка клиента

1. Откройте папку `client-accounting`
2. Создайте файл `.env.local` с содержимым:

```bash
VITE_API_URL=https://abc-123-def.ngrok-free.app/api
VITE_SOCKET_URL=https://abc-123-def.ngrok-free.app
```

ВАЖНО: Замените `https://abc-123-def.ngrok-free.app` на ваш реальный URL из ngrok!

## Шаг 6: Перезапустите клиент

1. Остановите клиент (Ctrl+C в окне с npm run dev)
2. Запустите снова:
```bash
npm run dev
```

## Шаг 7: Добавьте ngrok URL в CORS

В файле `server\.env` обновите:
```bash
CORS_ORIGIN=http://localhost:3000,http://localhost:3001,https://abc-123-def.ngrok-free.app
```

Перезапустите сервер!

## Готово!

Теперь можно подключаться:
- С компьютера: откройте ngrok URL в браузере
- С телефона: откройте тот же URL через мобильный интернет

---

## Troubleshooting

**Q: "ERR_NGROK_4018"**
A: Authtoken не установлен. Вернитесь к Шагу 2.

**Q: "Account limited"**  
A: Бесплатная версия ngrok имеет лимиты. Подождите или обновите аккаунт.

**Q: "CORS error"**
A: Убедитесь что ngrok URL добавлен в CORS_ORIGIN и сервер перезапущен.

**Q: URL меняется при каждом запуске**
A: Бесплатная версия ngrok даёт случайные URL. Для статического URL нужен платный план (~$8/мес).

---

## После выполнения всех шагов сообщите мне!
