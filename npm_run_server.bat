@echo off
echo ========================================
echo   Running: npm run server
echo ========================================
echo.
call npm run server
echo.
echo ========================================
echo   Command finished with exit code: %ERRORLEVEL%
echo ========================================
pause
