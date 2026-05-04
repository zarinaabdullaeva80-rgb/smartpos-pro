@echo off
chcp 65001 >nul 2>&1
title SmartPOS Pro - Первая настройка
color 0B

echo ══════════════════════════════════════════════════════════
echo       SmartPOS Pro - Автоматическая настройка
echo ══════════════════════════════════════════════════════════
echo.

:: ─── Шаг 1: Проверяем, установлен ли PostgreSQL ─────────────
echo [1/4] Проверка PostgreSQL...

set PSQL_PATH=
set PG_BIN=

:: Ищем psql.exe в стандартных путях
for %%v in (18 17 16 15 14) do (
    if exist "C:\Program Files\PostgreSQL\%%v\bin\psql.exe" (
        set "PG_BIN=C:\Program Files\PostgreSQL\%%v\bin"
        set "PSQL_PATH=C:\Program Files\PostgreSQL\%%v\bin\psql.exe"
        echo    ✓ PostgreSQL %%v найден: !PG_BIN!
        goto :pg_found
    )
)

:: Проверяем в PATH
where psql >nul 2>&1
if %ERRORLEVEL%==0 (
    for /f "delims=" %%i in ('where psql') do set "PSQL_PATH=%%i"
    for %%i in ("%PSQL_PATH%") do set "PG_BIN=%%~dpi"
    echo    ✓ PostgreSQL найден в PATH
    goto :pg_found
)

:: PostgreSQL не найден — устанавливаем
echo    ✗ PostgreSQL не найден.
echo.
echo [2/4] Установка PostgreSQL...
echo.

:: Проверяем, есть ли установщик в папке tools
set "INSTALLER_PATH=%~dp0server\tools\postgresql-installer.exe"
if not exist "%INSTALLER_PATH%" (
    echo    Скачиваем PostgreSQL 17...
    echo    Это может занять несколько минут...
    echo.
    
    powershell -Command "& { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $ProgressPreference = 'SilentlyContinue'; try { Invoke-WebRequest -Uri 'https://get.enterprisedb.com/postgresql/postgresql-17.4-1-windows-x64.exe' -OutFile '%INSTALLER_PATH%' -UseBasicParsing } catch { Write-Host '   ОШИБКА: Не удалось скачать PostgreSQL.'; Write-Host '   Скачайте вручную: https://www.postgresql.org/download/windows/'; Write-Host '   Сохраните как: %INSTALLER_PATH%'; exit 1 } }"
    
    if not exist "%INSTALLER_PATH%" (
        echo.
        echo    ══════════════════════════════════════════════
        echo    ОШИБКА: Не удалось скачать PostgreSQL.
        echo    Скачайте установщик вручную:
        echo    https://www.postgresql.org/download/windows/
        echo    Сохраните файл как:
        echo    %INSTALLER_PATH%
        echo    Затем запустите этот скрипт снова.
        echo    ══════════════════════════════════════════════
        echo.
        pause
        exit /b 1
    )
    echo    ✓ PostgreSQL скачан!
)

echo    Запускаем тихую установку PostgreSQL...
echo    (Это может занять 2-3 минуты)
echo.

:: Тихая установка PostgreSQL с паролем postgres
"%INSTALLER_PATH%" --mode unattended --unattendedmodeui minimal --superpassword postgres --servicename postgresql --servicepassword postgres --serverport 5432 --prefix "C:\Program Files\PostgreSQL\17" --datadir "C:\Program Files\PostgreSQL\17\data"

if %ERRORLEVEL% NEQ 0 (
    echo    ⚠ Установка завершилась с предупреждениями (это нормально)
)

:: Обновляем пути
set "PG_BIN=C:\Program Files\PostgreSQL\17\bin"
set "PSQL_PATH=C:\Program Files\PostgreSQL\17\bin\psql.exe"

:: Ждём запуска сервиса
echo    Ожидание запуска PostgreSQL сервиса...
timeout /t 5 /nobreak >nul

echo    ✓ PostgreSQL установлен!

:pg_found
setlocal enabledelayedexpansion

echo.
echo [3/4] Настройка базы данных...

:: Устанавливаем пароль для подключения
set PGPASSWORD=postgres

:: Проверяем, есть ли наша база данных
"%PSQL_PATH%" -h localhost -p 5432 -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='accounting_db'" 2>nul | findstr "1" >nul

if %ERRORLEVEL% NEQ 0 (
    echo    Создание базы данных accounting_db...
    "%PSQL_PATH%" -h localhost -p 5432 -U postgres -d postgres -c "CREATE DATABASE accounting_db ENCODING 'UTF8'" 2>nul
    
    if exist "%~dp0server\db_backup\smartpos_ready.backup" (
        echo    Восстановление данных из резервной копии...
        set "PG_RESTORE=%PG_BIN%\pg_restore.exe"
        "!PG_RESTORE!" -h localhost -p 5432 -U postgres -d accounting_db --no-owner --no-privileges "%~dp0server\db_backup\smartpos_ready.backup" 2>nul
        echo    ✓ База данных создана и данные восстановлены!
    ) else (
        echo    ✓ База данных создана (пустая)
    )
) else (
    echo    ✓ База данных accounting_db уже существует
)

echo.
echo [4/4] Обновление конфигурации...

:: Обновляем .env файл с правильным паролем
set "ENV_FILE=%~dp0server\.env"
if exist "%ENV_FILE%" (
    :: Проверяем, нужно ли обновить пароль
    findstr /C:"DB_PASSWORD=postgres" "%ENV_FILE%" >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo    Обновление пароля базы данных в .env...
        powershell -Command "(Get-Content '%ENV_FILE%') -replace 'DB_PASSWORD=.*', 'DB_PASSWORD=postgres' -replace 'postgresql://postgres:.*@localhost', 'postgresql://postgres:postgres@localhost' | Set-Content '%ENV_FILE%'"
    )
)
echo    ✓ Конфигурация готова!

echo.
echo ══════════════════════════════════════════════════════════
echo    ✅ SmartPOS Pro готов к работе!
echo.
echo    Вы можете запустить приложение:
echo    → SmartPOS Pro.exe
echo ══════════════════════════════════════════════════════════
echo.
pause
