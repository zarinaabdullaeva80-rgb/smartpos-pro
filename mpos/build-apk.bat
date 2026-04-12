@echo off
setlocal enabledelayedexpansion

set "ANDROID_HOME=C:\Users\user\AppData\Local\Android\Sdk"
set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.18.8-hotspot"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%"

echo ================================
echo SmartPOS Pro APK Builder v4.0.0
echo ================================

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
echo Step 2: Building APK...
cd /d "%BUILD_DIR%\android"
echo sdk.dir=C:\\Users\\user\\AppData\\Local\\Android\\Sdk> local.properties
call gradlew.bat assembleRelease

if !ERRORLEVEL! EQU 0 (
    echo.
    echo ================================
    echo BUILD SUCCESSFUL!
    echo ================================
    copy /Y "%BUILD_DIR%\android\app\build\outputs\apk\release\app-release.apk" "%SRC%SmartPOS-v4.0.0.apk"
    echo.
    echo APK saved to: %SRC%SmartPOS-v4.0.0.apk
) else (
    echo.
    echo BUILD FAILED!
)

echo.
echo Cleaning build dir...
cd /d C:\
rd /s /q "%BUILD_DIR%" 2>nul
pause