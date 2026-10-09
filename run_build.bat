@echo off
setlocal enabledelayedexpansion
title raymond-log Builder

echo ========================================================
echo          raymond-log Automated Build Script
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/4] Cleaning previous builds and staging directories...
if exist dist rd /s /q dist
if exist staging rd /s /q staging
if exist deploy.zip del /f /q deploy.zip

echo.
echo [2/4] Building frontend application (Vite + TypeScript)...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Frontend build failed! Check errors above.
    pause
    exit /b %errorlevel%
)

echo.
echo [3/4] Staging production release files...
mkdir staging
mkdir staging\dist
mkdir staging\server

xcopy dist staging\dist /E /I /Q /Y >nul
xcopy server staging\server /E /I /Q /Y >nul
copy package.json staging\package.json >nul
if exist package-lock.json copy package-lock.json staging\package-lock.json >nul

echo.
echo [4/4] Creating deploy.zip archive...
powershell -NoProfile -Command "Compress-Archive -Path 'staging\*' -DestinationPath 'deploy.zip' -Force"
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to generate deploy.zip!
    pause
    exit /b %errorlevel%
)

rd /s /q staging

echo.
echo ========================================================
echo  SUCCESS: Build and packaging completed!
echo  Output file: %~dp0deploy.zip
echo ========================================================
echo.
pause