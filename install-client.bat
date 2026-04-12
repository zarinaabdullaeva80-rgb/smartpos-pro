@echo off
chcp 65001 >nul
title SmartPOS Pro - Установка для клиента
color 0B

echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║                                                  ║
echo  ║        SmartPOS Pro - Полная установка            ║
echo  ║                                                  ║
echo  ║   Этот установщик выполнит:                      ║
echo  ║   1. Установку PostgreSQL 16                     ║
echo  ║   2. Создание базы данных                        ║
echo  ║   3. Установку SmartPOS Pro                      ║
echo  ║                                                  ║
echo  ╚══════════════════════════════════════════════════╝
echo.

:: =====================================================
:: ПРОВЕРКА ПРАВ АДМИНИСТРАТОРА
:: =====================================================
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Требуются права администратора!
    echo     Нажмите правой кнопкой → "Запуск от имени администратора"
    echo.
    pause
    exit /b 1
)

echo [✓] Права администратора получены
echo.

:: =====================================================
:: ПЕРЕМЕННЫЕ
:: =====================================================
set PG_VERSION=16
set PG_PASSWORD=Smash2206
set PG_PORT=5432
set PG_USER=postgres
set DB_NAME=accounting_db
set INSTALL_DIR=%~dp0

:: =====================================================
:: ШАГ 1: ПРОВЕРКА / УСТАНОВКА POSTGRESQL
:: =====================================================
echo ═══════════════════════════════════════════════════
echo   Шаг 1/3: PostgreSQL
echo ═══════════════════════════════════════════════════

:: Проверяем, установлен ли уже PostgreSQL (расширенный поиск)
set PG_BIN=
for %%V in (17 16 15 14 13 12) do (
    if exist "C:\Program Files\PostgreSQL\%%V\bin\psql.exe" (
        set PG_BIN=C:\Program Files\PostgreSQL\%%V\bin
        set PG_VERSION=%%V
        echo [✓] PostgreSQL %%V найден: C:\Program Files\PostgreSQL\%%V
        goto :pg_installed
    )
    if exist "C:\Program Files (x86)\PostgreSQL\%%V\bin\psql.exe" (
        set PG_BIN=C:\Program Files (x86)\PostgreSQL\%%V\bin
        set PG_VERSION=%%V
        echo [✓] PostgreSQL %%V найден: C:\Program Files (x86)\PostgreSQL\%%V
        goto :pg_installed
    )
)

:: Попытка найти через PATH
where psql.exe >nul 2>&1
if %errorlevel% equ 0 (
    for /f "delims=" %%P in ('where psql.exe') do (
        set PG_BIN=%%~dpP
        echo [✓] PostgreSQL найден в PATH: %%P
        goto :pg_installed
    )
)

:: Проверка через порт — если 5432 занят, PostgreSQL уже работает
netstat -an 2>nul | findstr "LISTENING" | findstr ":5432 " >nul
if %errorlevel% equ 0 (
    echo [✓] PostgreSQL уже работает на порту 5432
    :: Ищем psql.exe через реестр
    for /f "tokens=2*" %%A in ('reg query "HKLM\SOFTWARE\PostgreSQL\Installations" /s /v "Base Directory" 2^>nul ^| findstr /i "Base Directory"') do (
        if exist "%%B\bin\psql.exe" (
            set PG_BIN=%%B\bin
            echo [✓] PostgreSQL найден: %%B
        )
    )
    if not defined PG_BIN (
        :: Если psql не найден но порт занят — всё равно пропускаем установку
        echo [!] psql.exe не найден в PATH, но PostgreSQL работает на порту 5432
        echo     Если нужны миграции, добавьте путь к PostgreSQL\bin в переменную PATH
        set PG_BIN=SKIP
    )
    goto :pg_installed
)

:: PostgreSQL не найден — устанавливаем
echo [*] PostgreSQL не найден, начинаем установку...

:: Проверяем наличие установщика
set PG_INSTALLER=
if exist "%INSTALL_DIR%postgresql-16-windows-x64.exe" (
    set PG_INSTALLER=%INSTALL_DIR%postgresql-16-windows-x64.exe
)
if exist "%INSTALL_DIR%postgresql-*.exe" (
    for %%F in ("%INSTALL_DIR%postgresql-*.exe") do set PG_INSTALLER=%%F
)

if "%PG_INSTALLER%"=="" (
    echo [*] Скачиваем PostgreSQL 16...
    
    :: Пробуем скачать через PowerShell
    powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; try { Invoke-WebRequest -Uri 'https://get.enterprisedb.com/postgresql/postgresql-16.6-1-windows-x64.exe' -OutFile '%INSTALL_DIR%postgresql-16-setup.exe' -UseBasicParsing } catch { Write-Host 'DOWNLOAD_FAILED' }}" 2>nul
    
    if exist "%INSTALL_DIR%postgresql-16-setup.exe" (
        set PG_INSTALLER=%INSTALL_DIR%postgresql-16-setup.exe
        echo [✓] PostgreSQL скачан
    ) else (
        echo.
        echo [!] Не удалось скачать PostgreSQL автоматически.
        echo     Пожалуйста скачайте PostgreSQL 16 вручную:
        echo     https://www.enterprisedb.com/downloads/postgres-postgresql-downloads
        echo.
        echo     Или положите файл postgresql-16-windows-x64.exe
        echo     в папку: %INSTALL_DIR%
        echo.
        echo     После установки PostgreSQL запустите этот установщик снова.
        echo.
        pause
        exit /b 1
    )
)

echo [*] Устанавливаем PostgreSQL %PG_VERSION% (это может занять 2-5 минут)...
echo     Пароль суперпользователя: %PG_PASSWORD%
echo.

:: Тихая установка PostgreSQL
"%PG_INSTALLER%" --mode unattended --unattendedmodeui minimal ^
    --superpassword "%PG_PASSWORD%" ^
    --serverport %PG_PORT% ^
    --prefix "C:\Program Files\PostgreSQL\%PG_VERSION%" ^
    --datadir "C:\Program Files\PostgreSQL\%PG_VERSION%\data" ^
    --install_runtimes 0 ^
    --enable-components server,commandlinetools

if %errorlevel% neq 0 (
    echo [!] Ошибка установки PostgreSQL
    echo     Попробуйте установить PostgreSQL вручную
    pause
    exit /b 1
)

set PG_BIN=C:\Program Files\PostgreSQL\%PG_VERSION%\bin
echo [✓] PostgreSQL %PG_VERSION% установлен успешно!

:pg_installed
echo.

:: =====================================================
:: ШАГ 2: СОЗДАНИЕ БАЗЫ ДАННЫХ
:: =====================================================
echo ═══════════════════════════════════════════════════
echo   Шаг 2/3: Создание базы данных
echo ═══════════════════════════════════════════════════

:: Если psql не найден но PostgreSQL работает — пропускаем создание БД
if "%PG_BIN%"=="SKIP" (
    echo [!] psql.exe не доступен — пропускаем создание БД
    echo     SmartPOS Pro создаст базу данных автоматически при первом запуске
    echo.
    goto :install_smartpos
)

:: Ждём запуска PostgreSQL
echo [*] Ожидаем запуск PostgreSQL...
set /a ATTEMPTS=0

:wait_pg
set /a ATTEMPTS+=1
if %ATTEMPTS% gtr 15 (
    echo [!] PostgreSQL не запустился за 30 секунд
    echo     Проверьте, что служба PostgreSQL запущена
    pause
    exit /b 1
)

set PGPASSWORD=%PG_PASSWORD%
"%PG_BIN%\psql.exe" -h localhost -p %PG_PORT% -U %PG_USER% -d postgres -c "SELECT 1" >nul 2>&1
if %errorlevel% neq 0 (
    echo     Попытка %ATTEMPTS%/15...
    timeout /t 2 /nobreak >nul
    goto :wait_pg
)

echo [✓] PostgreSQL запущен

:: Проверяем, существует ли база данных
"%PG_BIN%\psql.exe" -h localhost -p %PG_PORT% -U %PG_USER% -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='%DB_NAME%'" 2>nul | findstr "1" >nul
if %errorlevel% equ 0 (
    echo [✓] База данных '%DB_NAME%' уже существует
) else (
    echo [*] Создаём базу данных '%DB_NAME%'...
    "%PG_BIN%\psql.exe" -h localhost -p %PG_PORT% -U %PG_USER% -d postgres -c "CREATE DATABASE %DB_NAME% ENCODING 'UTF8'"
    if %errorlevel% neq 0 (
        echo [!] Ошибка создания базы данных
        pause
        exit /b 1
    )
    echo [✓] База данных создана
)

echo.

:: =====================================================
:: ШАГ 3: УСТАНОВКА SMARTPOS PRO
:: =====================================================
:install_smartpos
echo ═══════════════════════════════════════════════════
echo   Шаг 3/3: Установка SmartPOS Pro
echo ═══════════════════════════════════════════════════

:: Ищем установщик SmartPOS Pro
set SMARTPOS_INSTALLER=
for %%F in ("%INSTALL_DIR%SmartPOS Pro Setup*.exe") do set SMARTPOS_INSTALLER=%%F

if "%SMARTPOS_INSTALLER%"=="" (
    echo [!] Не найден установщик SmartPOS Pro!
    echo     Положите файл "SmartPOS Pro Setup X.X.X.exe" в папку:
    echo     %INSTALL_DIR%
    pause
    exit /b 1
)

echo [*] Запускаем установку SmartPOS Pro...
echo     Установщик: %SMARTPOS_INSTALLER%
echo.

start /wait "" "%SMARTPOS_INSTALLER%"

echo.
echo ═══════════════════════════════════════════════════
echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║                                                  ║
echo  ║   ✓ Установка SmartPOS Pro завершена!            ║
echo  ║                                                  ║
echo  ║   PostgreSQL: localhost:%PG_PORT%                      ║
echo  ║   База данных: %DB_NAME%                       ║
echo  ║   Пароль БД:   %PG_PASSWORD%                    ║
echo  ║                                                  ║
echo  ║   Логин:  admin                                  ║
echo  ║   Пароль: admin                                  ║
echo  ║                                                  ║
echo  ║   Запустите SmartPOS Pro с рабочего стола!        ║
echo  ║                                                  ║
echo  ╚══════════════════════════════════════════════════╝
echo.
pause
