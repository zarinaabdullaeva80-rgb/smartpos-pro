@echo off
setlocal

:: Set environment variables
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.18.8-hotspot

:: Navigate to android directory
cd /d "%~dp0android"

:: Clean previous build
echo Cleaning previous build...
call gradlew.bat clean

:: Build Release APK
echo Building Release APK...
call gradlew.bat assembleRelease --stacktrace

:: Check if build succeeded
if exist "app\build\outputs\apk\release\app-release.apk" (
    echo.
    echo ========================================
    echo BUILD SUCCESSFUL!
    echo ========================================
    echo.
    echo APK created at:
    echo %~dp0android\app\build\outputs\apk\release\app-release.apk
    echo.
    pause
) else (
    echo.
    echo ========================================
    echo BUILD FAILED!
    echo ========================================
    echo Check the error messages above
    echo.
    pause
)
