# Управление учётными данными

## Файл конфигурации
`database/init-users.json` - настройка начальных пользователей

## Изменение логина и пароля

### Для создателя системы:
Откройте `database/init-users.json` и измените:
```json
{
  "creator": {
    "username": "Smash2206",
    "password": "Smash.2206",
    "email": "smash@1c-accounting.com",
    "full_name": "Создатель системы"
  }
}
```

### Для администратора:
```json
{
  "admin": {
    "username": "admin",
    "password": "admin",
    "email": "admin@1c-accounting.com",
    "full_name": "Администратор"
  }
}
```

## Применение изменений

После изменения `init-users.json` выполните:
```bash
cd database
npm run quick-init
```

⚠️ **ВНИМАНИЕ**: Это пересоздаст всю базу данных!

## Текущие учётные данные

### Создатель:
- Логин: `Smash2206`
- Пароль: `Smash.2206`
- Уровень: Super Admin

### Администратор:
- Логин: `admin`
- Пароль: `admin`
- Уровень: Super Admin

## Вход в программы

Эти учётные данные работают во всех 3 программах:
1. **Desktop** (client-accounting) - `http://localhost:3000`
2. **Admin Panel** (client-admin) - `http://localhost:3001`
3. **Mobile POS** (mobile-pos) - Expo app

## Безопасность

🔒 **Рекомендуется:**
1. Изменить пароли после первого входа
2. Не использовать простые пароли в production
3. Хранить `init-users.json` в безопасном месте
4. Добавить `init-users.json` в `.gitignore`
