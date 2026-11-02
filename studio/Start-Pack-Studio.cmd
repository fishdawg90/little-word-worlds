@echo off
cd /d "%~dp0.."
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 22 or newer from https://nodejs.org and try again.
  pause
  exit /b 1
)
if not exist "node_modules\ws\package.json" (
  call npm install --omit=dev
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
start "" http://127.0.0.1:8777
node studio/server.mjs
pause
