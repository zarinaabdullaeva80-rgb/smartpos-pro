@echo off
echo ========================================
echo  SmartPOS Pro - Cloud Mode Activation
echo ========================================

set CONFIG_DIR=%APPDATA%\smartpos-pro
set CONFIG_FILE=%CONFIG_DIR%\cloud-config.json
set SERVER_CONFIG=%CONFIG_DIR%\server-config.json

echo Creating config folder...
if not exist "%CONFIG_DIR%" mkdir "%CONFIG_DIR%"

echo Setting cloud API URL...
echo {"api_url": "https://smartpos-pro-production-f885.up.railway.app/api"} > "%CONFIG_FILE%"

echo Setting server mode to cloud...
echo {"server_mode": "cloud"} > "%SERVER_CONFIG%"

echo.
echo ========================================
echo  Done! SmartPOS Pro will connect to
echo  Railway cloud server on next launch.
echo ========================================
echo.
pause
