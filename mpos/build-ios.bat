@echo off
chcp 65001 >nul
echo ============================================
echo    SmartPOS Pro iOS Build (EAS Cloud)  
echo ============================================
echo.

cd /d "%~dp0"

:: Check if EAS CLI is installed
where eas >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [INFO] Installing EAS CLI...
    call npm install -g eas-cli
)

:: Check if logged in
echo [1/3] Checking Expo account...
call eas whoami 2>nul
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ACTION] You need to log in to Expo:
    call eas login
)

echo.
echo Choose build type:
echo   1 - iOS Device (needs Apple Developer $99/yr)
echo   2 - iOS Simulator (FREE, no credentials needed)
echo   3 - Expo Go (no build needed - use QR code)
echo.
set /p choice="Enter choice (1/2/3): "

if "%choice%"=="1" (
    echo.
    echo [2/3] Starting iOS DEVICE build...
    echo       You will need Apple Developer credentials.
    echo.
    call eas build --platform ios --profile preview
) else if "%choice%"=="2" (
    echo.
    echo [2/3] Starting iOS SIMULATOR build...
    echo       No Apple credentials needed!
    echo.
    call eas build --platform ios --profile ios-simulator
) else if "%choice%"=="3" (
    echo.
    echo [2/3] Starting Expo Go dev server...
    echo       Scan QR code with iPhone camera
    echo.
    call npx expo start
    goto :end
) else (
    echo Invalid choice.
    goto :end
)

echo.
echo ============================================
echo    Build complete!
echo    Download from: https://expo.dev
echo ============================================
echo.
echo To install on iPhone:
echo   Option 1: AltStore (free sideloading)
echo     - Install AltServer on PC: https://altstore.io
echo     - Connect iPhone via USB
echo     - Install AltStore on iPhone
echo     - Open .ipa through AltStore
echo.
echo   Option 2: Expo Go (easiest, no build needed)
echo     - Install "Expo Go" from App Store
echo     - Run: npx expo start
echo     - Scan QR code with iPhone
echo.

:end
pause
