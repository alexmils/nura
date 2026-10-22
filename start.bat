@echo off
setlocal
cd /d "%~dp0"

title NuraHelp

echo.
echo  NuraHelp - starting...
echo.

if not exist "node_modules\" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

echo Starting PostgreSQL (Docker, port 5434)...
docker compose up -d
if errorlevel 1 (
  echo Docker failed. Is Docker Desktop running?
  pause
  exit /b 1
)

echo Waiting for database...
timeout /t 3 /nobreak >nul

echo Freeing port 3471 if in use...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3471" ^| findstr "LISTENING"') do (
  taskkill /PID %%a /F >nul 2>&1
)
timeout /t 1 /nobreak >nul

echo.
echo  App:  http://localhost:3471
echo  Dev:  npm run dev       (clears cache, stable)
echo        npm run dev:fast  (no cache clear)
echo  Stop: Ctrl+C
echo  Tip:  do not delete .next while dev is running
echo.
echo  (The browser is not opened automatically.)

call npm run dev

pause
