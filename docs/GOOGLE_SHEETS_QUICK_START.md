# Краткая Инструкция: Настройка Google Sheets

## Шаг 1: Google Cloud Console

1. Откройте https://console.cloud.google.com/
2. Создайте новый проект или выберите существующий
3. Перейдите в **APIs & Services** → **Library**
4. Найдите и включите:
   - Google Sheets API 
   - Google Drive API

## Шаг 2: Service Account

1. **APIs & Services** → **Credentials**
2. **Create Credentials** → **Service Account**
3. Заполните:
   - Название: `1c-sync`
   - Нажмите **Create and Continue**
   - Пропустите остальные шаги → **Done**

## Шаг 3: JSON Ключ

1. Найдите созданный Service Account в списке
2. Нажмите на него → вкладка **Keys**
3. **Add Key** → **Create new key** → выберите **JSON**
4. Файл автоматически скачается
5. **Скопируйте email Service Account** - понадобится для шага 5
   - Формат: `1c-sync@your-project.iam.gserviceaccount.com`

## Шаг 4: Создание Google Таблицы

1. Откройте https://docs.google.com/spreadsheets/
2. Создайте новую таблицу: **1С Бухгалтерия - Синхронизация**
3. Создайте 4 листа (снизу нажмите +):
   - **Товары**
   - **Продажи**
   - **Остатки**
   - **Статистика**

## Шаг 5: Предоставление Доступа

1. В Google Таблице найдите кнопку в правом верхнем углу:
   - **Русская версия**: "Настройки доступа" или "Доступ" (синяя кнопка)
   - **Английская версия**: "Share" 
   - Находится рядом с иконкой вашего профиля
   
2. Нажмите на кнопку "Настройки доступа"

3. В открывшемся окне:
   - Вставьте **email Service Account** из шага 3
     (формат: `1c-sync@your-project.iam.gserviceaccount.com`)
   - Выберите права: **Редактор** (Editor)
   - **ВАЖНО**: Снимите галочку "Оповестить" (Notify people)
   - Нажмите "Отправить" или "Готово"

## Шаг 6: Spreadsheet ID

Скопируйте ID из URL таблицы:
```
https://docs.google.com/spreadsheets/d/1AbC...xyz/edit
                                        ↑↑↑ это ID ↑↑↑
```

## Шаг 7: Настройка Backend

1. Переместите скачанный JSON файл в папку server:
   ```
   Переименуйте в google-credentials.json
   Скопируйте в: C:\Users\user\Desktop\1С бухгалтерия\server\
   ```

2. Отредактируйте файл `.env` в папке server:
   ```env
   # Раскомментируйте и обновите:
   GOOGLE_SHEETS_CREDENTIALS_PATH=./google-credentials.json
   GOOGLE_SHEETS_SPREADSHEET_ID=ваш_id_из_шага_6
   ```

## Шаг 8: Перезапуск Сервера

Сервер автоматически перезапустится (nodemon).

В логах должно появиться:
```
✓ Google Sheets API инициализирован
✓ База данных подключена
```

## Шаг 9: Тестирование

### Вариант А: Ручная синхронизация
Откройте в браузере:
```
http://localhost:5000/api/sync/sync-all
```

Или используйте curl:
```powershell
curl -X POST http://localhost:5000/api/sync/sync-all
```

### Вариант Б: Автоматическая синхронизация
Подождите 5 минут - система синхронизируется автоматически.

## Проверка Результата

1. Откройте вашу Google Таблицу
2. Проверьте листы:
   - **Товары** - должны появиться все товары из БД
   - **Продажи** - все продажи (если есть)
   - **Остатки** - товары с остатками > 0
   - **Статистика** - общая статистика системы

## Возможные Проблемы

### "Google Sheets credentials не настроены"
- Проверьте путь к файлу в `.env`
- Файл должен называться `google-credentials.json`

### "The caller does not have permission"
- Убедитесь, что предоставили доступ Service Account к таблице
- Проверьте email Service Account

### "Spreadsheet not found"
- Проверьте GOOGLE_SHEETS_SPREADSHEET_ID в `.env`
- Скопируйте ID из URL таблицы заново

---

**Готово!** После настройки данные будут автоматически синхронизироваться каждые 5 минут.
