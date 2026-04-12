@echo off
chcp 65001 >nul 2>&1
title SmartPOS Pro — Миграция Railway БД

echo =========================================
echo   SmartPOS Pro — Railway DB Migration
echo =========================================
echo.

REM Проверяем наличие .env с DATABASE_URL
if exist "%~dp0server\.env" (
    echo [INFO] Загружаем .env из server\.env
    for /f "usebackq tokens=1,2 delims==" %%A in ("%~dp0server\.env") do (
        if "%%A"=="DATABASE_URL" (
            set "DATABASE_URL=%%B"
        )
    )
)

if "%DATABASE_URL%"=="" (
    echo.
    echo [WARN] DATABASE_URL не найден в server\.env
    echo.
    set /p DATABASE_URL="Введите DATABASE_URL (postgresql://user:pass@host:port/db): "
)

if "%DATABASE_URL%"=="" (
    echo [ERROR] DATABASE_URL не указан. Выход.
    pause
    exit /b 1
)

echo.
echo [INFO] DATABASE_URL установлен
echo [INFO] Запускаем миграции...
echo.

cd /d "%~dp0database"
set DATABASE_URL=%DATABASE_URL%
node apply-migrations.js

echo.
if %ERRORLEVEL% EQU 0 (
    echo ✅ Миграции успешно применены!
) else (
    echo ❌ Ошибка при применении миграций!
)
echo.
pause
