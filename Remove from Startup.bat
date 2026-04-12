@echo off
chcp 65001 >nul
echo ============================================
echo   Удаление SmartPOS Server из автозапуска
echo ============================================
echo.

set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_PATH=%STARTUP_FOLDER%\SmartPOS Server.lnk"

if exist "%SHORTCUT_PATH%" (
    del "%SHORTCUT_PATH%"
    echo ✅ SmartPOS Server удален из автозапуска
) else (
    echo ⚠️ SmartPOS Server не был в автозапуске
)

echo.
pause
