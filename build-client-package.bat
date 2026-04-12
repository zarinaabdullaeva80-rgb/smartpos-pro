@echo off
chcp 65001 >nul
echo =====================================================
echo   Создание пакета для клиента
echo =====================================================
echo.

set PROJECT_DIR=%~dp0
set OUTPUT_DIR=%PROJECT_DIR%SmartPOS-Client-Delivery

:: Очистка старого пакета
if exist "%OUTPUT_DIR%" rmdir /s /q "%OUTPUT_DIR%"
mkdir "%OUTPUT_DIR%"

echo [1/4] Сборка приложения...
cd /d "%PROJECT_DIR%client-accounting"
call npm run build
if %errorlevel% neq 0 (
    echo [ОШИБКА] Сборка не удалась
    pause
    exit /b 1
)

echo.
echo [2/4] Создание установщика...
:: Удалить старый dist
if exist "dist-electron" rmdir /s /q "dist-electron"
call npm run dist
if %errorlevel% neq 0 (
    echo [ОШИБКА] Создание установщика не удалось
    pause
    exit /b 1
)

echo.
echo [3/4] Копирование файлов в пакет...

:: Копируем установщик SmartPOS Pro
for %%F in ("dist-electron\SmartPOS Pro Setup*.exe") do (
    copy "%%F" "%OUTPUT_DIR%\" >nul
    echo   ✓ %%~nxF
)

:: Копируем скрипт установки
copy "%PROJECT_DIR%install-client.bat" "%OUTPUT_DIR%\" >nul
echo   ✓ install-client.bat

echo.
echo [4/5] Скачивание PostgreSQL 16...

:: Проверяем, есть ли уже скачанный PostgreSQL
set PG_FILE=%OUTPUT_DIR%\postgresql-16-windows-x64.exe
if exist "%PG_FILE%" (
    echo   ✓ PostgreSQL 16 уже есть в пакете
) else (
    echo   Скачиваем PostgreSQL 16 (~300MB, подождите...
    powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; try { $ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri 'https://get.enterprisedb.com/postgresql/postgresql-16.6-1-windows-x64.exe' -OutFile '%PG_FILE%' -UseBasicParsing; Write-Host 'OK' } catch { Write-Host 'FAILED:' $_.Exception.Message }}"
    if exist "%PG_FILE%" (
        echo   ✓ PostgreSQL 16 скачан
    ) else (
        echo   [!] Не удалось скачать PostgreSQL автоматически.
        echo       Скачайте вручную: https://www.enterprisedb.com/downloads/postgres-postgresql-downloads
        echo       и положите в: %OUTPUT_DIR%
    )
)

echo.
echo [5/5] Создание инструкции...
(
echo =====================================================
echo   SmartPOS Pro - Инструкция по установке
echo =====================================================
echo.
echo 1. Скачайте PostgreSQL 16 с сайта:
echo    https://www.enterprisedb.com/downloads/postgres-postgresql-downloads
echo    и положите файл в эту папку
echo.
echo    ИЛИ установщик скачает PostgreSQL автоматически
echo.
echo 2. Запустите "install-client.bat" от имени администратора
echo    ^(правая кнопка мыши → "Запуск от имени администратора"^)
echo.
echo 3. Дождитесь завершения установки
echo.
echo 4. Запустите SmartPOS Pro с рабочего стола
echo.
echo 5. Войдите: логин=admin, пароль=admin
echo.
echo =====================================================
echo   Поддержка: smartpos.pro
echo =====================================================
) > "%OUTPUT_DIR%\ИНСТРУКЦИЯ.txt"
echo   ✓ ИНСТРУКЦИЯ.txt

cd /d "%PROJECT_DIR%"

echo.
echo =====================================================
echo   Готово! Пакет для клиента:
echo   %OUTPUT_DIR%
echo.
echo   Содержимое:
dir /b "%OUTPUT_DIR%"
echo =====================================================
echo.

explorer "%OUTPUT_DIR%"
pause
