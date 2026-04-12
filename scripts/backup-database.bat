@echo off
REM ============================================================================
REM Скрипт автоматического резервного копирования PostgreSQL БД
REM Использование: backup-database.bat
REM ============================================================================

SETLOCAL EnableDelayedExpansion

REM Параметры подключения к БД
SET PGHOST=localhost
SET PGPORT=5432
SET PGUSER=postgres
SET PGPASSWORD=Smash2206
SET PGDATABASE=accounting_1c

REM Директория для бэкапов
SET BACKUP_DIR=C:\backups\1c-accounting
SET LOG_DIR=C:\backups\1c-accounting\logs

REM Путь к pg_dump (измените если PostgreSQL установлен в другое место)
SET PGDUMP="C:\Program Files\PostgreSQL\18\bin\pg_dump.exe"

REM Создание директорий если не существуют
IF NOT EXIST "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
IF NOT EXIST "%LOG_DIR%" mkdir "%LOG_DIR%"

REM Формирование имени файла с датой и временем
FOR /F "tokens=1-3 delims=/- " %%a IN ('date /t') DO (
    SET DATE=%%c%%b%%a
)
FOR /F "tokens=1-2 delims=: " %%a IN ('time /t') DO (
    SET TIME=%%a%%b
)
SET TIMESTAMP=%DATE%_%TIME::=%
SET BACKUP_FILE=%BACKUP_DIR%\backup_%TIMESTAMP%.sql
SET BACKUP_COMPRESSED=%BACKUP_DIR%\backup_%TIMESTAMP%.7z
SET LOG_FILE=%LOG_DIR%\backup_%TIMESTAMP%.log

REM Начало бэкапа
echo ============================================ >> "%LOG_FILE%"
echo Backup started: %DATE% %TIME% >> "%LOG_FILE%"
echo ============================================ >> "%LOG_FILE%"
echo.
echo [%TIME%] Начало резервного копирования БД: %PGDATABASE%
echo.

REM Выполнение pg_dump
echo [%TIME%] Создание дампа БД... >> "%LOG_FILE%"
%PGDUMP% -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %PGDATABASE% -F p -b -v -f "%BACKUP_FILE%" 2>> "%LOG_FILE%"

IF %ERRORLEVEL% NEQ 0 (
    echo [ОШИБКА] Не удалось создать бэкап БД! >> "%LOG_FILE%"
    echo [ОШИБКА] Не удалось создать бэкап БД!
    echo Проверьте лог: %LOG_FILE%
    pause
    exit /b 1
)

REM Получение размера файла
FOR %%A IN ("%BACKUP_FILE%") DO SET FILESIZE=%%~zA
SET /A FILESIZE_MB=!FILESIZE! / 1048576

echo [%TIME%] Дамп создан успешно: %FILESIZE_MB% MB >> "%LOG_FILE%"
echo [%TIME%] Файл: %BACKUP_FILE% >> "%LOG_FILE%"
echo.
echo ✓ Дамп создан: %FILESIZE_MB% MB
echo.

REM Сжатие бэкапа (если установлен 7-Zip)
IF EXIST "C:\Program Files\7-Zip\7z.exe" (
    echo [%TIME%] Сжатие бэкапа... >> "%LOG_FILE%"
    "C:\Program Files\7-Zip\7z.exe" a -t7z "%BACKUP_COMPRESSED%" "%BACKUP_FILE%" -mx=9 >> "%LOG_FILE%" 2>&1
    
    IF %ERRORLEVEL% EQU 0 (
        echo [%TIME%] Бэкап сжат успешно >> "%LOG_FILE%"
        REM Удаление несжатого файла
        del "%BACKUP_FILE%"
        echo ✓ Бэкап сжат: %BACKUP_COMPRESSED%
        
        FOR %%A IN ("%BACKUP_COMPRESSED%") DO SET COMPSIZE=%%~zA
        SET /A COMPSIZE_MB=!COMPSIZE! / 1048576
        echo   Размер: !COMPSIZE_MB! MB
    ) ELSE (
        echo [ПРЕДУПРЕЖДЕНИЕ] Не удалось сжать бэкап >> "%LOG_FILE%"
        echo ! Не удалось сжать бэкап, оставлен несжатый файл
    )
) ELSE (
    echo [INFO] 7-Zip не найден, бэкап не сжат >> "%LOG_FILE%"
    echo ! 7-Zip не установлен, бэкап не сжат
)

echo.
echo ============================================ >> "%LOG_FILE%"
echo Backup completed: %DATE% %TIME% >> "%LOG_FILE%"
echo Удаление старых бэкапов (> 30 дней)... >> "%LOG_FILE%"
echo ============================================ >> "%LOG_FILE%"

REM Удаление старых бэкапов (старше 30 дней)
forfiles /p "%BACKUP_DIR%" /m backup_*.* /d -30 /c "cmd /c del @path" 2>nul
IF %ERRORLEVEL% EQU 0 (
    echo [%TIME%] Старые бэкапы удалены >> "%LOG_FILE%"
    echo ✓ Старые бэкапы удалены
) ELSE (
    echo [INFO] Нет старых бэкапов для удаления >> "%LOG_FILE%"
)

echo.
echo ============================================
echo ✓ Резервное копирование завершено успешно!
echo ============================================
echo.
echo Последний бэкап:
IF EXIST "%BACKUP_COMPRESSED%" (
    echo %BACKUP_COMPRESSED%
) ELSE (
    echo %BACKUP_FILE%
)
echo.
echo Лог: %LOG_FILE%
echo.

REM Вывод статистики
echo Всего бэкапов в директории:
dir /b "%BACKUP_DIR%\backup_*.*" 2>nul | find /c /v ""

ENDLOCAL
pause
