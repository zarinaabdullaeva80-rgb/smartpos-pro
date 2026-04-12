@echo off
REM PostgreSQL Automatic Backup Script for Windows
REM Schedule via Task Scheduler

SET DB_NAME=accounting_db
SET DB_USER=postgres
SET DB_HOST=localhost
SET BACKUP_DIR=C:\Users\user\Desktop\1С бухгалтерия\backups
SET DATE=%DATE:~10,4%-%DATE:~4,2%-%DATE:~7,2%_%TIME:~0,2%-%TIME:~3,2%-%TIME:~6,2%
SET DATE=%DATE: =0%
SET BACKUP_FILE=%BACKUP_DIR%\backup_%DB_NAME%_%DATE%.sql

REM Create backup directory
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

echo [%DATE% %TIME%] Starting backup of database: %DB_NAME%

REM Set password environment variable
SET PGPASSWORD=Smash2206

REM Create backup
"C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" -h %DB_HOST% -U %DB_USER% %DB_NAME% > "%BACKUP_FILE%"

if %ERRORLEVEL% EQU 0 (
    echo [%DATE% %TIME%] Backup successful: %BACKUP_FILE%
    
    REM Compress with PowerShell
    powershell -Command "Compress-Archive -Path '%BACKUP_FILE%' -DestinationPath '%BACKUP_FILE%.zip' -Force"
    del "%BACKUP_FILE%"
    
    echo [%DATE% %TIME%] Compressed backup created
    
    REM Delete backups older than 30 days
    forfiles /p "%BACKUP_DIR%" /s /m backup_*.zip /d -30 /c "cmd /c del @path" 2>nul
    
    echo [%DATE% %TIME%] Old backups cleaned up
) else (
    echo [%DATE% %TIME%] ERROR: Backup failed!
    exit /b 1
)

echo [%DATE% %TIME%] Backup completed successfully
pause
