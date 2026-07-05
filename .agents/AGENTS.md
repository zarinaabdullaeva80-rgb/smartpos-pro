# SmartPOS Pro — Правила для AI-агентов

## 🚨 КРИТИЧЕСКОЕ ПРАВИЛО: Проверка лицензий в auth middleware

### Проблема (уже была, зафиксирована 2026-07-05)

В таблице `licenses` поля `id` и `organization_id` — это **РАЗНЫЕ** числовые ряды.
На сервере f885: лицензия `Smash22` имела `id=12, organization_id=13`.
Лицензия `Nurullo262` имела `id=13, status=expired`.

Старый баг-запрос:
```sql
-- ❌ ЗАПРЕЩЕНО — это возвращало чужую просроченную лицензию!
SELECT status FROM licenses WHERE id = $1 OR organization_id = $1
```
При `organization_id=13` у Smash22 этот запрос находил лицензию `id=13` (Nurullo262, expired!)
и блокировал активного пользователя.

### Правило

> **НИКОГДА** не писать `WHERE id = X OR organization_id = X` в таблице `licenses`.
> `id` и `organization_id` — разные пространства ID. Смешивать их в одном условии запрещено.

### Правильный паттерн (уже зафиксирован в `server/src/middleware/auth.js`)

```javascript
// ✅ ПРАВИЛЬНО: сначала по license_id, потом fallback по organization_id
let licRes;
if (user.license_id) {
    licRes = await pool.query(
        'SELECT id, status, expires_at FROM licenses WHERE id = $1 LIMIT 1',
        [user.license_id]
    );
}
if ((!licRes || licRes.rows.length === 0) && user.organization_id) {
    licRes = await pool.query(
        'SELECT id, status, expires_at FROM licenses WHERE organization_id = $1 LIMIT 1',
        [user.organization_id]
    );
}
```

---

## 🌐 HTTPS на Railway/Cloudflare

Express за реверс-прокси Railway/Cloudflare должен иметь:
```javascript
app.set('trust proxy', true); // обязательно в server/src/index.js
```
Без этого `req.protocol` возвращает `http` вместо `https`, и `server_url` в ответе
лицензии будет неправильным. Это уже исправлено в `server/src/index.js`.

Для Railway/ngrok хостов дополнительно принудительно определяем протокол:
```javascript
const forwardedProto = req.headers['x-forwarded-proto'];
if (forwardedProto) detectedProtocol = forwardedProto.split(',')[0].trim();
else if (host.includes('railway.app')) detectedProtocol = 'https';
```

---

## 📋 Ключевые файлы

| Файл | Описание |
|------|----------|
| `server/src/middleware/auth.js` | Auth + проверка лицензии (КРИТИЧНО) |
| `server/src/index.js` | Express app init, trust proxy |
| `server/src/routes/licensing.js` | Эндпоинты лицензий |
| `server/src/routes/auth.js` | Логин, JWT |
