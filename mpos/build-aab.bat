@echo off
setlocal enabledelayedexpansion

set "ANDROID_HOME=C:\Users\user\AppData\Local\Android\Sdk"
set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.18.8-hotspot"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%"

echo ==========================================
echo SmartPOS Pro AAB Builder (Google Play)
echo ==========================================

set "BUILD_DIR=C:\smartpos-build"
set "SRC=%~dp0"

echo Cleaning old build dir...
if exist "%BUILD_DIR%" rd /s /q "%BUILD_DIR%" 2>nul
if exist "%BUILD_DIR%" (
    echo [WARN] Cannot delete %BUILD_DIR%, trying to reuse...
) else (
    echo Copying mpos to %BUILD_DIR%...
    echo This may take 1-2 minutes...
    robocopy "%SRC%." "%BUILD_DIR%" /MIR /NFL /NDL /NJH /NJS /NC /NS /NP
    echo Copy complete.
)

echo.
echo Step 1: expo prebuild...
cd /d "%BUILD_DIR%"
call npx expo prebuild --platform android --clean
if !ERRORLEVEL! NEQ 0 (
    echo [ERROR] prebuild failed
    pause
    exit /b 1
)

echo.
echo Step 1.5: Injecting Release Signing Config into Android project...
:: 1. Копируем файл keystore в android/app/
copy /Y "%SRC%android\app\my-upload-key.keystore" "%BUILD_DIR%\android\app\my-upload-key.keystore"
if !ERRORLEVEL! NEQ 0 (
    echo [ERROR] Failed to copy keystore file!
    pause
    exit /b 1
)

:: 2. Дописываем настройки подписи в android/gradle.properties
echo.>> "%BUILD_DIR%\android\gradle.properties"
echo # SmartPOS Pro Android Release Signing Config>> "%BUILD_DIR%\android\gradle.properties"
echo MYAPP_UPLOAD_STORE_FILE=my-upload-key.keystore>> "%BUILD_DIR%\android\gradle.properties"
echo MYAPP_UPLOAD_KEY_ALIAS=smartpos-release-key>> "%BUILD_DIR%\android\gradle.properties"
echo MYAPP_UPLOAD_STORE_PASSWORD=smartpos2026>> "%BUILD_DIR%\android\gradle.properties"
echo MYAPP_UPLOAD_KEY_PASSWORD=smartpos2026>> "%BUILD_DIR%\android\gradle.properties"

:: 3. Обновляем android/app/build.gradle, чтобы применить подпись к релизу
node inject-signing.js

echo Config injected successfully.

echo.
echo Step 2: Building AAB (bundleRelease)...
cd /d "%BUILD_DIR%\android"
echo sdk.dir=C:\\Users\\user\\AppData\\Local\\Android\\Sdk> local.properties
call gradlew.bat bundleRelease

if !ERRORLEVEL! EQU 0 (
    echo.
    echo ==========================================
    echo BUILD SUCCESSFUL!
    echo ==========================================
    copy /Y "%BUILD_DIR%\android\app\build\outputs\bundle\release\app-release.aab" "%SRC%SmartPOS-Pro-v4.2.4.aab"
    echo.
    echo AAB saved to: %SRC%SmartPOS-Pro-v4.2.4.aab
    echo.
    echo Upload this AAB to Google Play Console:
    echo https://play.google.com/console
) else (
    echo.
    echo BUILD FAILED!
)

echo.
echo Cleaning build dir...
cd /d C:\
rd /s /q "%BUILD_DIR%" 2>nul
pause
