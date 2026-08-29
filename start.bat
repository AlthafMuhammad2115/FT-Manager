@echo off
title Proteus Production TV Dashboard & Admin Server
echo ========================================================
echo   PROTEUS PRODUCTION LINE TRACKER (43" TV & ADMIN)
echo ========================================================
echo.
SET PATH=%~dp0tools\node;%PATH%

echo [1/2] Starting Proteus Node.js Server on port 5000...
echo TV Display URL:   http://localhost:5000
echo Admin Panel URL:  http://localhost:5000/#admin
echo.
cd /d "%~dp0server"
node server.js
pause
