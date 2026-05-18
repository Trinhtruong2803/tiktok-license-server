@echo off
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║                                                            ║
echo ║   🔐 TVT LICENSE SERVER                                    ║
echo ║                                                            ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js chưa được cài đặt!
    echo.
    echo Vui lòng tải và cài Node.js từ: https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo ✅ Node.js version:
node --version
echo.

REM Check if dependencies are installed
if not exist "node_modules" (
    echo 📦 Đang cài đặt dependencies...
    echo.
    call npm install
    echo.
)

echo 🚀 Đang khởi động server...
echo.
echo Dashboard: http://localhost:8008/dashboard.html
echo.

node server.js

pause
