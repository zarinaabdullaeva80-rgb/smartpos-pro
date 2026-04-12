@echo off
chcp 65001 >nul
title SmartPOS Server

echo ============================================
echo    SmartPOS Pro Server - Автозапуск
echo ============================================
echo.

REM Проверяем что Node.js установлен
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js не найден! Установите Node.js
    pause
    exit /b 1
)

REM Переходим в папку сервера
cd /d "%~dp0server"

REM Проверяем что node_modules существуют
if not exist "node_modules" (
    echo 📦 Установка зависимостей...
    npm install
)

echo.
echo 🚀 Запуск сервера SmartPOS Pro...
echo    Сервер будет доступен по адресу: http://localhost:5000
echo    API: http://localhost:5000/api
echo.
echo    Для остановки закройте это окно
echo ============================================
echo.

REM Запуск сервера
node src/index.js

REM Если сервер упал, перезапустить через 5 секунд
:restart
echo.
echo ⚠️ Сервер остановлен. Перезапуск через 5 секунд...
timeout /t 5 /nobreak >nul
node src/index.js
goto restart
