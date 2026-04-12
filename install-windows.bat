@echo off
chcp 65001 >nul
title SmartPOS Pro - Установка для Windows

echo ================================================
echo   SmartPOS Pro - Автоматическая установка
echo   Для Windows Server / Windows 10+
echo ================================================
echo.

:: Проверка прав администратора
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ОШИБКА] Запустите скрипт от имени Администратора!
    pause
    exit /b 1
)

set INSTALL_DIR=C:\SmartPOS
set DB_NAME=smartpos_pro
set DB_USER=smartpos
set DB_PASS=SmartPOS2026!

echo [1/6] Создание директорий...
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
if not exist "%INSTALL_DIR%\logs" mkdir "%INSTALL_DIR%\logs"
if not exist "%INSTALL_DIR%\uploads" mkdir "%INSTALL_DIR%\uploads"
if not exist "%INSTALL_DIR%\backups" mkdir "%INSTALL_DIR%\backups"

echo [2/6] Проверка Node.js...
where node >nul 2>&1
if %errorLevel% neq 0 (
    echo [!] Node.js не найден. Скачайте с https://nodejs.org
    echo     Установите Node.js 18+ и перезапустите скрипт.
    pause
    exit /b 1
)
echo     Node.js: OK

echo [3/6] Проверка PostgreSQL...
where psql >nul 2>&1
if %errorLevel% neq 0 (
    echo [!] PostgreSQL не найден. Скачайте с https://postgresql.org
    echo     Установите PostgreSQL 14+ и перезапустите скрипт.
    pause
    exit /b 1
)
echo     PostgreSQL: OK

echo [4/6] Копирование файлов сервера...
xcopy /E /I /Y ".\server" "%INSTALL_DIR%\server"

echo [5/6] Создание файла конфигурации...
(
echo # SmartPOS Pro Configuration
echo NODE_ENV=production
echo PORT=5000
echo.
echo # Database
echo DATABASE_URL=postgresql://%DB_USER%:%DB_PASS%@localhost:5432/%DB_NAME%
echo.
echo # JWT
echo JWT_SECRET=your-super-secret-key-change-me-in-production
echo JWT_EXPIRES_IN=7d
echo.
echo # Redis (опционально)
echo REDIS_URL=redis://localhost:6379
) > "%INSTALL_DIR%\server\.env"

echo [6/6] Установка зависимостей...
cd /d "%INSTALL_DIR%\server"
call npm install --production

echo.
echo ================================================
echo   УСТАНОВКА ЗАВЕРШЕНА!
echo ================================================
echo.
echo Директория установки: %INSTALL_DIR%
echo.
echo Следующие шаги:
echo 1. Создайте базу данных PostgreSQL:
echo    CREATE DATABASE %DB_NAME%;
echo    CREATE USER %DB_USER% WITH PASSWORD '%DB_PASS%';
echo.
echo 2. Отредактируйте файл:
echo    %INSTALL_DIR%\server\.env
echo.
echo 3. Примените миграции:
echo    cd %INSTALL_DIR%\server
echo    npm run migrate
echo.
echo 4. Запустите сервер:
echo    npm start
echo.
echo ================================================
pause
