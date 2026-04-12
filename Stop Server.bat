@echo off
chcp 65001 >nul
echo ============================================
echo    Остановка SmartPOS Server
echo ============================================
echo.

REM Находим и убиваем процессы node.js которые запущены из папки server
for /f "tokens=2" %%a in ('tasklist /fi "imagename eq node.exe" /fo list ^| find "PID:"') do (
    echo Остановка процесса node.exe PID: %%a
    taskkill /pid %%a /f >nul 2>nul
)

echo.
echo ✅ Сервер остановлен
echo.
pause
