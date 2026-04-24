@echo off
chcp 65001 >nul
echo =====================================================
echo   Публикация обновления SmartPOS Pro
echo =====================================================
echo.

set DIST_DIR=%~dp0client-accounting\dist-electron
set UPDATES_DIR=%~dp0server\updates

:: Создать папку если нет
if not exist "%UPDATES_DIR%" mkdir "%UPDATES_DIR%"

:: Найти latest.yml и .exe в dist-electron
echo [1/3] Поиск файлов сборки...
if not exist "%DIST_DIR%\latest.yml" (
    echo [ОШИБКА] latest.yml не найден в dist-electron
    echo Сначала запустите build-1c-accounting.bat
    pause
    exit /b 1
)

:: Копировать latest.yml
echo [2/3] Копирование файлов обновления...
copy /Y "%DIST_DIR%\latest.yml" "%UPDATES_DIR%\latest.yml"
echo   ✓ latest.yml скопирован

:: Копировать .exe файл
for %%f in ("%DIST_DIR%\*.exe") do (
    echo   Копирую: %%~nxf
    copy /Y "%%f" "%UPDATES_DIR%\%%~nxf"
    echo   ✓ %%~nxf скопирован
)

:: Копировать blockmap если есть
for %%f in ("%DIST_DIR%\*.blockmap") do (
    copy /Y "%%f" "%UPDATES_DIR%\%%~nxf"
    echo   ✓ %%~nxf скопирован
)

echo.
echo [3/3] Готово!
echo.
echo =====================================================
echo   Файлы обновления в: %UPDATES_DIR%
echo.
echo   Теперь перезапустите сервер и клиенты
echo   автоматически получат обновление.
echo =====================================================
echo.
pause
