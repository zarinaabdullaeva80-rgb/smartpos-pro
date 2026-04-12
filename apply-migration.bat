@echo off
chcp 65001 > nul
echo Применение миграции БД для способов оплаты и возвратов...
echo.

REM Попробовать без пароля через переменную окружения
set PGPASSWORD=
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d accounting_1c -f "database\migrations\006-payment-methods-and-returns.sql" -w

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ===============================================
    echo ✅ Миграция успешно применена!
    echo ===============================================
) else (
    echo.
    echo ===============================================
    echo ❌ Ошибка при применении миграции
    echo Попробуйте также: trust authentication или peer authentication
    echo ===============================================
)

echo.
pause
