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
echo =====================================================
echo   Готово!
echo   Установщик находится в:
echo   client-accounting\dist-electron\
echo =====================================================
echo.

explorer "dist-electron"
pause
