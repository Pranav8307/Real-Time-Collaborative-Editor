@echo off
echo Starting Nimbus Collaborative Editor...
echo.
echo Starting Server...
start "Nimbus Server" cmd /k "cd server && if not exist .env copy .env.example .env && node src/index.js"
timeout /t 3 /nobreak >nul
echo Starting Client...
start "Nimbus Client" cmd /k "cd client && npm run dev"
echo.
echo Server: http://localhost:3001
echo Client: http://localhost:3000
echo.
echo Press any key to close this window (servers will continue running)...
pause >nul

