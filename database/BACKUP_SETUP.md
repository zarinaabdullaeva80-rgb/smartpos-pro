# Инструкция по настройке автоматического резервного копирования

## Шаг 1: Проверка скрипта

Убедитесь, что скрипт `scripts\backup-database.bat` создан и параметры корректны:
- Путь к PostgreSQL
- Имя БД
- Пользователь и пароль
- Директория для бэкапов

## Шаг 2: Ручной запуск (тест)

Запустите скрипт вручную для проверки:
```cmd
cd c:\Users\user\Desktop\1С бухгалтерия
scripts\backup-database.bat
```

Проверьте, что:
- Бэкап создался: `C:\backups\1c-accounting\`
- Нет ошибок в логе
- Размер файла корректный

## Шаг 3: Настройка автозапуска через Task Scheduler

### Вариант A: Через PowerShell

Откройте PowerShell от имени администратора и выполните:

```powershell
# Создать задачу
$action = New-ScheduledTaskAction -Execute "C:\Users\user\Desktop\1С бухгалтерия\scripts\backup-database.bat"

# Триггер: каждый день в 2:00
$trigger = New-ScheduledTaskTrigger -Daily -At 2:00AM

# Настройки
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

# Регистрация задачи
Register-ScheduledTask -TaskName "1C Accounting DB Backup" `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "Ежедневное резервное копирование БД 1C Accounting" `
    -User "SYSTEM" `
    -RunLevel Highest
```

### Вариант B: Через GUI

1. Откройте **Планировщик заданий** (Task Scheduler)
2. Нажмите **Создать задачу** (Create Task)
3. **Общие** (General):
   - Имя: `1C Accounting DB Backup`
   - Описание: `Ежедневное резервное копирование БД`
   - Выбрать: "Выполнять с наивысшими правами"
   - Пользователь: `SYSTEM`

4. **Триггеры** (Triggers):
   - Нажмите "Создать"
   - Начать задачу: `По расписанию`
   - Настройка: `Ежедневно`
   - Время: `02:00`
   - Включено: ✓

5. **Действия** (Actions):
   - Нажмите "Создать"
   - Действие: `Запуск программы`
   - Программа: `C:\Users\user\Desktop\1С бухгалтерия\scripts\backup-database.bat`

6. **Условия** (Conditions):
   - Снять: "Запускать только при питании от сети"
   - Установить: "Пробуждать компьютер для выполнения задачи"

7. **Параметры** (Settings):
   - Установить: "Выполнять задачу при пропуске запланированного запуска"

8. Нажмите **ОК**

## Шаг 4: Проверка работы

### Немедленный запуск для теста
```powershell
Start-ScheduledTask -TaskName "1C Accounting DB Backup"
```

### Проверка последнего запуска
```powershell
Get-ScheduledTask -TaskName "1C Accounting DB Backup" | Get-ScheduledTaskInfo
```

### Просмотр истории
1. Планировщик заданий → найти задачу
2. Вкладка "История"

## Шаг 5: Мониторинг

### Логи бэкапов
Проверяйте логи регулярно:
```
C:\backups\1c-accounting\logs\
```

### Размер бэкапов
Примерные размеры:
- БД ~50 MB → Бэкап ~10-15 MB (сжатый)
- БД ~500 MB → Бэкап ~100-150 MB (сжатый)

### Очистка старых бэкапов
Скрипт автоматически удаляет бэкапы старше 30 дней.

Для изменения периода редактируйте строку в скрипте:
```batch
forfiles /p "%BACKUP_DIR%" /m backup_*.* /d -30 /c "cmd /c del @path"
                                              ^^^ изменить здесь
```

## Восстановление из бэкапа

### Через psql

```cmd
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d accounting_1c < "C:\backups\1c-accounting\backup_YYYYMMDD_HHMM.sql"
```

### Через pgAdmin
1. Правый клик на БД
2. Restore
3. Выбрать файл бэкапа
4. Restore

## Рекомендации

✅ **DO:**
- Проверяйте бэкапы раз в неделю
- Храните копии бэкапов на другом диске/в облаке
- Тестируйте восстановление раз в месяц

❌ **DON'T:**
- Не храните все бэкапы бесконечно (автоочистка 30 дней)
- Не запускайте бэкап во время активной работы
- Не отключайте логирование

## Альтернативные расписания

### Каждые 6 часов
```powershell
$trigger = New-ScheduledTaskTrigger -Once -At 12:00AM -RepetitionInterval (New-TimeSpan -Hours 6) -RepetitionDuration (New-TimeSpan -Days 365)
```

### Каждую неделю (воскресенье)
```powershell
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 2:00AM
```

### Каждый месяц (1 числа)
```powershell
$trigger = New-ScheduledTaskTrigger -Daily -At 2:00AM
# + дополнительно настроить в GUI: "Месяцы" → все, "Дни" → 1
```
