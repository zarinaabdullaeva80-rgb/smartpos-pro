@echo off
chcp 65001 >nul
echo =====================================================
echo   Сборка 1С Бухгалтерия (.exe)
echo =====================================================
echo.

cd /d "%~dp0client-accounting"

echo [1/3] Установка зависимостей...
call npm install
if %errorlevel% neq 0 (
    echo [ОШИБКА] Не удалось установить зависимости
    pause
    exit /b 1
)

echo.
echo [2/3] Сборка production версии...
call npm run build
if %errorlevel% neq 0 (
    echo [ОШИБКА] Не удалось собрать приложение
    pause
    exit /b 1
)

echo.
echo [3/3] Создание .exe файла...
call npm run dist
if %errorlevel% neq 0 (
    echo [ОШИБКА] Не удалось создать .exe файл
    pause
    exit /b 1
)

echo.
echo [4/4] Автоматическая публикация в папку сервера...
set "UPDATES_DIR=%~dp0server\updates"
if not exist "%UPDATES_DIR%" mkdir "%UPDATES_DIR%"

:: Копируем все .exe и .blockmap из dist-electron в server/updates
xcopy /Y /S "%~dp0client-accounting\dist-electron\*.exe" "%UPDATES_DIR%\"
xcopy /Y /S "%~dp0client-accounting\dist-electron\*.blockmap" "%UPDATES_DIR%\"
xcopy /Y /S "%~dp0client-accounting\dist-electron\latest.yml" "%UPDATES_DIR%\"

echo.
echo =====================================================
echo   ГОТОВО! Версия собрана и скопирована в сервер.
echo   Путь: %UPDATES_DIR%
echo.
echo   Теперь просто сделайте Git Push, чтобы
echo   обновление стало доступно всем пользователям.
echo =====================================================
echo.
pause

