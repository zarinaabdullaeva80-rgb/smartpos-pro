# Развёртывание нового клиента SmartPOS Pro

## Вариант 1: Multi-Tenant (общий сервер)

### Шаг 1: Создать лицензию

```bash
# POST /api/onboarding/create-license
curl -X POST https://smartpos-pro-production-f885.up.railway.app/api/onboarding/create-license \
  -H "Content-Type: application/json" \
  -H "x-master-key: smartpos-master-2026" \
  -d '{
    "plan": "pro",
    "days": 365,
    "company_name": "Название клиента"
  }'
```

**Планы:**
| План | Пользователей | Товаров | Цена |
|------|---------------|---------|------|
| basic | 5 | 1,000 | Бесплатно |
| pro | 20 | 5,000 | Платно |
| enterprise | 100 | 50,000 | Индивидуально |

**Результат:** Лицензионный ключ `XXXX-XXXX-XXXX-XXXX`

### Шаг 2: Отправить ключ клиенту

Клиент вводит ключ в PWA или Desktop при первом запуске.

### Шаг 3: Регистрация клиента

Клиент выполняет через интерфейс (или API):

```bash
# POST /api/onboarding/register
curl -X POST https://smartpos-pro-production-f885.up.railway.app/api/onboarding/register \
  -H "Content-Type: application/json" \
  -d '{
    "license_key": "XXXX-XXXX-XXXX-XXXX",
    "company_name": "Кафе Самарканд",
    "admin_username": "admin",
    "admin_password": "securepass",
    "admin_full_name": "Администратор"
  }'
```

**Результат:**
- Создаётся организация
- Создаётся admin-пользователь с `organization_id`
- Возвращается JWT токен

### Шаг 4: Вход клиента

Клиент входит через:
- **Desktop Web:** `https://smartpos-pro-production-f885.up.railway.app/`
- **Mobile PWA:** `https://smartpos-pro-production-f885.up.railway.app/mobile/`
- **APK:** Скачать с GitHub Releases

### Шаг 5: Управление сотрудниками

Admin клиента может:
1. Создавать сотрудников через `/api/employees`
2. Назначать роли (Кассир, Продавец, Администратор)
3. Все данные автоматически изолированы по `organization_id`

---

## Вариант 2: Отдельный Railway (изолированный)

### Шаг 1: Fork репозитория

```bash
# Клонировать
git clone https://github.com/zarinaabdullaeva80-rgb/smartpos-pro.git smartpos-<client-name>
cd smartpos-<client-name>
```

### Шаг 2: Создать Railway проект

1. Зайти на [railway.app](https://railway.app)
2. New Project → Deploy from GitHub repo
3. Выбрать форкнутый репозиторий

### Шаг 3: Добавить PostgreSQL

1. New Service → Database → PostgreSQL
2. Скопировать **Public** DATABASE_URL

### Шаг 4: Настроить переменные

```env
DATABASE_URL=postgresql://postgres:...@....proxy.rlwy.net:PORT/railway
JWT_SECRET=unique-secret-for-this-client
PORT=5000
NODE_ENV=production
```

### Шаг 5: Первая настройка БД

БД инициализируется автоматически при первом запуске. Создать admin:

```bash
# Через API
curl -X POST https://<client-url>.up.railway.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@client.com",
    "password": "securepassword",
    "fullName": "Администратор"
  }'
```

---

## Вариант 3: Self-Hosted (EXE)

1. Скачать `SmartPOS.Pro.Setup.4.0.0.exe` с [GitHub Releases](https://github.com/zarinaabdullaeva80-rgb/smartpos-pro/releases/tag/v4.0.0)
2. Установить на компьютер клиента
3. Программа автоматически создаёт локальный PostgreSQL
4. Все данные хранятся локально
5. **Не требует интернета**

---

## Проверка лицензии

```bash
# GET /api/onboarding/verify/:key
curl https://smartpos-pro-production-f885.up.railway.app/api/onboarding/verify/XXXX-XXXX-XXXX-XXXX
```

Ответ:
```json
{
  "valid": true,
  "registered": false,
  "organization": "Название",
  "plan": "pro",
  "expires_at": "2027-04-12T...",
  "expired": false
}
```

---

## Контакты / Master Key

- **Railway URL:** `https://smartpos-pro-production-f885.up.railway.app`
- **Master Key:** `smartpos-master-2026` (для create-license API)
- **GitHub:** `https://github.com/zarinaabdullaeva80-rgb/smartpos-pro`
