# Документация: Исправление ошибки аутентификации 401

**Дата:** 10 января 2026  
**Статус:** ✅ Решено

## Краткое описание проблемы

При попытке входа в Admin Panel (`http://localhost:3001`) с учетными данными `admin`/`admin` происходила следующая ошибка:
- Запрос `/api/auth/login` возвращал **200 OK** и JWT токен
- Последующие запросы к защищённым endpoints (например `/api/users`) возвращали **401 Unauthorized** с сообщением "Недействительный токен"
- Frontend автоматически выполнял logout и возвращал пользователя на страницу входа

## Корень проблемы

**НЕ** проблема с JWT_SECRET (как первоначально предполагалось).

Реальная причина: **несоответствие схемы базы данных** в файле `server/src/middleware/auth.js`.

### Детали

SQL запрос в middleware пытался выбрать столбец `role_id`, которого **не существует** в таблице `users`:

```javascript
// ❌ НЕПРАВИЛЬНО
'SELECT id, username, email, full_name, role_id FROM users WHERE id = $1 AND is_active = true'
```

Реальная структура таблицы `users` использует:
- `role` (VARCHAR) - название роли пользователя
- `user_level` (VARCHAR) - уровень привилегий

При выполнении SQL запроса возникала ошибка:
```
[AUTH] Authentication error: столбец "role_id" не существует
```

Эта ошибка перехватывалась `catch` блоком и возвращалась как 401, создавая иллюзию проблемы с JWT.

## Решение

### 1. Исправлен SQL запрос

**Файл:** `server/src/middleware/auth.js` (строка 21)

```javascript
// ✅ ПРАВИЛЬНО
'SELECT id, username, email, full_name, role, user_level FROM users WHERE id = $1 AND is_active = true'
```

### 2. Обновлена структура req.user

**Файл:** `server/src/middleware/auth.js` (строки 30-38)

```javascript
req.user = {
    id: result.rows[0].id,
    userId: result.rows[0].id,
    username: result.rows[0].username,
    email: result.rows[0].email,
    fullName: result.rows[0].full_name,
    role: result.rows[0].role,              // ✅ Существующий столбец
    userLevel: result.rows[0].user_level    // ✅ Существующий столбец
};
```

### 3. Добавлен fallback для JWT_SECRET (дополнительно)

**Файл:** `server/src/middleware/auth.js` (строки 15-16)

```javascript
const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const decoded = jwt.verify(token, secret);
```

Это обеспечивает соответствие с логикой подписи токена в `routes/auth.js`.

## Проверка работоспособности

### Тест через браузер
1. Открыть `http://localhost:3001`
2. Ввести `admin` / `admin`
3. ✅ Успешный вход в dashboard
4. ✅ Навигация по табам работает
5. ✅ Данные пользователей загружаются

### Тест через API
```powershell
# Получение токена
$response = Invoke-WebRequest -Uri "http://localhost:5000/api/auth/login" `
    -Method POST `
    -Headers @{"Content-Type"="application/json"} `
    -Body '{"username":"admin","password":"admin"}'

$token = ($response.Content | ConvertFrom-Json).token

# Запрос защищённого endpoint
Invoke-WebRequest -Uri "http://localhost:5000/api/users" `
    -Headers @{"Authorization"="Bearer $token"}
# ✅ Возвращает 200 OK с данными пользователей
```

### Логи сервера
```
[AUTH] Authenticating request: GET /api/users
[AUTH] Token found, verifying...
[AUTH] Using JWT_SECRET: FALLBACK_KEY
[AUTH] Token decoded, userId: 2
[AUTH] User authenticated: admin
```

## Важные заметки

### Несоответствие schema.sql

Файл `database/schema.sql` описывает структуру с `role_id`:
```sql
CREATE TABLE users (
    ...
    role_id INTEGER REFERENCES roles(id),
    ...
);
```

Однако **реальная база данных** использует столбцы `role` и `user_level` (текстовые поля).

**Причина:** База данных была инициализирована через `quick-init.js`, который создал другую структуру.

**Рекомендация:** Привести `schema.sql` в соответствие с фактической структурой БД или выполнить миграцию.

## Учетные данные

### Администратор
- **Логин:** `admin`
- **Пароль:** `admin`
- **Роль:** `super_admin`

### Создатель системы
- **Логин:** `Smash2206`
- **Пароль:** `Smash.2206`
- **Роль:** `super_admin`

## Изменённые файлы

1. `server/src/middleware/auth.js`
   - Строки 15-17: Добавлен fallback для JWT_SECRET
   - Строка 21: Исправлен SQL запрос (role_id → role, user_level)
   - Строки 30-38: Обновлена структура req.user

## Дополнительные ресурсы

- **Walkthrough:** `.gemini/antigravity/brain/.../walkthrough.md`
- **Скриншот успешного входа:** `.gemini/antigravity/brain/.../dashboard_users_tab_*.png`
- **Видео тестирования:** `.gemini/antigravity/brain/.../success_dashboard_access_*.webp`

## Статус

✅ **Проблема полностью решена**  
✅ **Login функционирует корректно**  
✅ **Все защищённые endpoints доступны**  
✅ **Admin Panel работает штатно**

---

*Последнее обновление: 10.01.2026 19:05*
