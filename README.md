# SmartPOS Pro — Система управления бизнесом

> **Статус:** Production Ready ✅  
> **Версия:** 3.0.0  
> **Платформы:** Windows EXE (с автообновлением) · Web · Android APK (Expo)  
> **Прогресс:** 100% (130+ страниц, 50+ API модулей, EXE с auto-update, Telegram Bot, Mobile POS)

Полноценная POS-система и ERP для малого и среднего бизнеса: продажи, склад, финансы, CRM, аналитика, Telegram-уведомления.

---

## 🚀 Быстрый старт

### Требования

- Node.js 18+
- PostgreSQL 16+
- npm или yarn

### Установка

```bash
# 1. Клонировать репозиторий
git clone https://github.com/your-org/1c-accounting.git
cd 1c-accounting

# 2. Установить зависимости
cd server && npm install
cd ../client-accounting && npm install

# 3. Настроить базу данных
createdb accounting_1c
cd ../database
for f in migrations/*.sql; do psql -d accounting_1c -f "$f"; done

# 4. Настроить переменные окружения
cd ../server
cp .env.example .env
# Отредактировать .env

# 5. Запустить
npm run dev  # Backend на :5000
cd ../client-accounting
npm start    # Frontend на :3000
```

Логин по умолчанию: `admin` / `admin123`

---

## 📦 Что включено

### ✅ Базовый функционал

- **Товары:** Управление товарами, категориями, остатками
- **Продажи:** Кассовые смены, чеки, Z-отчёты
- **Закупки:** Приход товаров, накладные
- **Контрагенты:** Клиенты и поставщики
- **Склад:** Множественные склады

### ✅ WMS (Warehouse Management System)

- **Инвентаризация:** Подсчёт, корректировки, сканирование
- **Партионный учёт:** FIFO списание, сроки годности, alerts
- **Адресное хранение:** Зоны, стеллажи, уровни, ячейки
- **Карта склада:** Визуализация и управление ячейками

### ✅ CRM

- **Воронка продаж:** Kanban board с 7 этапами, Drag & Drop
- **Программа лояльности:** 4 уровня (Bronze→Platinum), баллы
- **RFM-анализ:** 11 сегментов клиентов с диаграммами
- **Email-маркетинг:** Кампании, шаблоны, сегментация

### ✅ Автоматизация

- **Запланированные задачи:** 7 типов (бэкапы, истечение баллов, отчёты)
- **Уведомления:** 7 типов (низкий остаток, сроки, заказы)
- **Telegram Bot:** Команды /sales, /stock, /notifications

### ✅ Безопасность

- **RBAC:** 43 права, 6 ролей, защита всех endpoints
- **Audit Log:** Логирование всех действий
- **JWT:** Токены с refresh
- **40+ индексов** для производительности

### ✅ Аналитика

- **ABC-анализ:** Классификация товаров
- **P&L:** Отчёт о прибылях и убытках
- **Прогнозы:** Moving Average
- **Dashboards:** Визуализация метрик

### ✅ Документооборот

- **7 типов документов:** ТОРГ-12, счёт-фактура, акт и др.
- **Система шаблонов:** HTML с переменными
- **API генерации:** Готово к PDF export
- **Реквизиты:** Управление данными организации

### ✅ UX/UI

- **Тёмная тема:** Переключение светлой/тёмной
- **Горячие клавиши:** Alt+T/C/S/N, Esc
- **Компактный режим:** Экономия места
- **Адаптивный дизайн:** Responsive

### ✅ Desktop EXE (Electron)

- **Встроенный сервер:** Запуск без внешних зависимостей
- **Автообновление:** electron-updater + GitHub Releases
- **NSIS Installer:** Установка/удаление через Windows
- **Экспорт файлов:** Excel, PDF в локальную папку

### ✅ Mobile POS (Android)

- **Expo + React Native:** 30+ экранов
- **Продажи:** Касса, сканер, чеки
- **Синхронизация:** С облачным и локальным сервером
- **Оффлайн-режим:** Работа без интернета

---

## 🗄️ Архитектура

### Backend

```
server/
├── src/
│   ├── routes/          # 44 роута, 210+ endpoints
│   ├── middleware/      # Auth, RBAC, Audit
│   ├── config/          # Database, environment
│   └── index.js         # Express app
├── .env                 # Конфигурация
└── package.json
```

### Frontend

```
client-accounting/
├── src/
│   ├── pages/           # 130 страниц
│   ├── components/      # Layout, ThemeToggle
│   ├── styles/          # CSS, темы
│   └── App.jsx
└── package.json
```

### Database

```
database/
└── migrations/          # 43 миграции
    ├── 001-006          # Базовая структура
    ├── 007-008          # RBAC, Audit
    ├── 009-013          # WMS, оптимизация
    ├── 014-017          # CRM
    ├── 018-019          # Автоматизация
    ├── 020              # Производительность
    ├── 021              # Документооборот
    └── 022-043          # Лицензирование, мульти-тенант, 2FA
```

---

## 📊 Статистика

- **43 миграции БД**
- **70+ таблиц**
- **50+ API модулей**
- **250+ API endpoints**
- **130+ React страниц**
- **30+ мобильных экранов (Expo)**
- **~25,000+ строк кода**
- **Windows EXE с автообновлением**

---

## 🔌 API Endpoints

### Основные

```
POST   /api/auth/login              - Вход
POST   /api/auth/refresh            - Обновить токен
GET    /api/products                - Список товаров
POST   /api/sales                   - Создать продажу
GET    /api/analytics/abc           - ABC-анализ
```

### WMS

```
GET    /api/wms/inventories         - Инвентаризации
POST   /api/wms/batches             - Создать партию
GET    /api/wms/locations           - Ячейки склада
```

### CRM

```
GET    /api/crm/deals               - Сделки
POST   /api/crm/loyalty/points      - Начислить баллы
GET    /api/crm/rfm/analysis        - RFM-анализ
POST   /api/crm/email/campaigns     - Email-кампания
```

### Автоматизация

```
GET    /api/telegram/webhook        - Telegram bot
GET    /api/documents/generate-torg12/:id  - ТОРГ-12
```

Полная документация: [Postman Collection](docs/API.md)

---

## 🎨 Скриншоты

<table>
<tr>
<td><img src="docs/screenshots/dashboard.png" width="250"/><br/>Dashboard</td>
<td><img src="docs/screenshots/sales-pipeline.png" width="250"/><br/>Kanban воронка</td>
<td><img src="docs/screenshots/rfm.png" width="250"/><br/>RFM-анализ</td>
</tr>
<tr>
<td><img src="docs/screenshots/inventory.png" width="250"/><br/>Инвентаризация</td>
<td><img src="docs/screenshots/warehouse-map.png" width="250"/><br/>Карта склада</td>
<td><img src="docs/screenshots/dark-theme.png" width="250"/><br/>Тёмная тема</td>
</tr>
</table>

---

## 🛠️ Production Deployment

### Быстрый деплой

```bash
# 1. Сервер с Ubuntu 20.04+
# 2. Установить зависимости
sudo apt update
sudo apt install nodejs postgresql nginx

# 3. Клонировать и настроить
git clone https://github.com/your-org/1c-accounting.git
cd 1c-accounting
# ... см. полный гайд

# 4. Запустить с PM2
pm2 start server/src/index.js --name accounting-server
```

**Полная инструкция:** [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

---

## 📚 Документация

### Production Guides

- [DEPLOYMENT.md](docs/DEPLOYMENT.md) - Production деплой
- [PDF_GENERATION.md](docs/PDF_GENERATION.md) - Генерация PDF
- [REDIS_SETUP.md](docs/REDIS_SETUP.md) - Кэширование
- [SENTRY_SETUP.md](docs/SENTRY_SETUP.md) - Мониторинг ошибок

### CI/CD

- [.github/workflows/ci-cd.yml](.github/workflows/ci-cd.yml) - GitHub Actions

---

## 🔐 Безопасность

### RBAC

43 права, 6 ролей:

- **Admin** - полный доступ
- **Manager** - управление продажами, контрагентами
- **Cashier** - только кассовые операции
- **Warehouse** - WMS функции
- **Analyst** - аналитика и отчёты
- **Viewer** - только просмотр

### Audit Log

Все действия логируются:

- Кто (user_id)
- Что (action, table_name)
- Когда (created_at)
- Откуда (ip_address)
- Данные (old_values/new_values)

---

## 🧪 Тестирование

```bash
# Backend тесты
cd server
npm test

# Lint
npm run lint

# Frontend build проверка
cd client-accounting
npm run build
```

---

## 🤝 Вклад

1. Fork репозитория
2. Создать feature branch (`git checkout -b feature/amazing-feature`)
3. Commit изменений (`git commit -m 'Add amazing feature'`)
4. Push в branch (`git push origin feature/amazing-feature`)
5. Открыть Pull Request

---

## 📝 Лицензия

MIT License - см. [LICENSE](LICENSE)

---

## 👥 Авторы

- **Ваше Имя** - *Initial work*

---

## 🎉 Благодарности

- PostgreSQL за мощную СУБД
- React команде за отличный фреймворк
- Всем контрибьюторам open-source библиотек

---

## 📞 Поддержка

- 📧 Email: <info@smartpos.pro>
- 💬 Telegram: @smartpos_pro
- 🐛 Issues: [GitHub Issues](https://github.com/smartpos-pro/smartpos-pro/issues)

---

**⭐ Поставьте звезду если проект вам понравился!**
