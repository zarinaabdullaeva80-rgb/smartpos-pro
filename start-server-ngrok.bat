@echo off
REM =====================================
REM SmartPOS Pro - Автозапуск сервера + ngrok
REM Запускает сервер и создаёт туннель через ngrok
REM =====================================

echo ========================================
echo   SmartPOS Pro - Запуск сервера
echo ========================================

REM Проверка ngrok
where ngrok >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ОШИБКА] ngrok не установлен!
    echo Скачайте с https://ngrok.com/download
    echo и добавьте в PATH
    pause
    exit /b 1
)

REM Установка пути к проекту
set PROJECT_DIR=%~dp0
cd /d "%PROJECT_DIR%"

echo [1/3] Запуск сервера SmartPOS Pro...
cd server
start "SmartPOS Server" cmd /k "npm start"

REM Подождать пока сервер запустится
echo [2/3] Ожидание запуска сервера (10 секунд)...
timeout /t 10 /nobreak >nul

echo [3/3] Запуск ngrok туннеля...
REM Запустить ngrok в фоне
start "ngrok" ngrok http 5000 --log=stdout

echo ========================================
echo   Сервер запущен!
echo ========================================
echo.
echo   Локальный адрес: http://localhost:5000
echo   Откройте окно ngrok чтобы увидеть публичный URL
echo.
echo   Передайте клиентам URL вида:
echo   https://xxxx-xx-xx-xx-xx.ngrok-free.app/api
echo ========================================

pause
