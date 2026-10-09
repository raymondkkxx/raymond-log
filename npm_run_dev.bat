@echo off
echo ========================================
echo   Running: npm run dev
echo ========================================
echo.
call npm run dev
echo.
echo ========================================
echo   Command finished with exit code: %ERRORLEVEL%
echo ========================================
pause
