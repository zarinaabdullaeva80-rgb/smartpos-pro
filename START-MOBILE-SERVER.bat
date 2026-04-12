@echo off
echo ========================================
echo    1C POS - Запуск сервера и ngrok
echo ========================================
echo.

echo [1/2] Запуск сервера...
start "1C Server" cmd /k "cd /d c:\Users\user\Desktop\1С бухгалтерия\server && npm start"

timeout /t 5 /nobreak > nul

echo [2/2] Запуск ngrok туннеля...
start "ngrok" cmd /k "ngrok http 5000"

echo.
echo ========================================
echo    Готово! Оба сервиса запущены.
echo ========================================
echo.
echo Сервер: http://localhost:5000
echo ngrok:  см. в окне ngrok (https://...)
echo.
pause
