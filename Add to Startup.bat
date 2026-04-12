@echo off
chcp 65001 >nul
echo ============================================
echo   Добавление SmartPOS Server в автозапуск
echo ============================================
echo.

set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SCRIPT_PATH=%~dp0Start Server Hidden.vbs"
set "SHORTCUT_PATH=%STARTUP_FOLDER%\SmartPOS Server.lnk"

REM Создаем ярлык в папке автозапуска
powershell -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%SHORTCUT_PATH%'); $Shortcut.TargetPath = '%SCRIPT_PATH%'; $Shortcut.WorkingDirectory = '%~dp0'; $Shortcut.Description = 'SmartPOS Pro Server'; $Shortcut.Save()"

if exist "%SHORTCUT_PATH%" (
    echo ✅ SmartPOS Server добавлен в автозапуск!
    echo.
    echo    Сервер будет запускаться автоматически при входе в Windows.
    echo    Ярлык создан: %SHORTCUT_PATH%
) else (
    echo ❌ Ошибка создания ярлыка
)

echo.
pause
