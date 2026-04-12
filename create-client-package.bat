@echo off
chcp 65001 >nul
title SmartPOS Pro - Создание пакета для клиента

echo ================================================
echo   SmartPOS Pro - Создание пакета для клиента
echo ================================================
echo.

set OUTPUT_DIR=SmartPOS-Client-Package
set ARCHIVE_NAME=SmartPOS-Pro-Client.zip

echo [1/5] Создание директории...
if exist "%OUTPUT_DIR%" rmdir /s /q "%OUTPUT_DIR%"
mkdir "%OUTPUT_DIR%"

echo [2/5] Копирование серверных файлов...
xcopy /E /I /Y "server" "%OUTPUT_DIR%\server"

echo [3/5] Копирование конфигурационных файлов...
copy "docker-compose-client.yml" "%OUTPUT_DIR%\docker-compose.yml"
copy ".env.client" "%OUTPUT_DIR%\.env.example"
copy "CLIENT_DEPLOYMENT.md" "%OUTPUT_DIR%\README.md"
copy "install-linux.sh" "%OUTPUT_DIR%\install-linux.sh"
copy "install-windows.bat" "%OUTPUT_DIR%\install-windows.bat"

echo [4/5] Копирование базы данных и миграций...
mkdir "%OUTPUT_DIR%\database"
xcopy /E /I /Y "database\migrations" "%OUTPUT_DIR%\database\migrations"

echo [5/5] Копирование дополнительных файлов...
if exist "nginx" mkdir "%OUTPUT_DIR%\nginx" && xcopy /E /I /Y "nginx" "%OUTPUT_DIR%\nginx"

echo.
echo ================================================
echo   Пакет для клиента создан!
echo ================================================
echo.
echo Директория: %OUTPUT_DIR%
echo.
echo Содержимое пакета:
echo   - server\           (серверные файлы)
echo   - database\         (миграции БД)
echo   - docker-compose.yml
echo   - .env.example
echo   - README.md
echo   - install-linux.sh
echo   - install-windows.bat
echo.
echo Заархивируйте папку %OUTPUT_DIR% и отправьте клиенту.
echo.
pause
