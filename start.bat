@echo off
title Re:List launcher
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install it from https://nodejs.org and run this again.
  pause
  exit /b 1
)

if not exist "backend\node_modules" (
  echo Installing backend packages...
  pushd backend
  call npm install
  popd
)
if not exist "frontend\node_modules" (
  echo Installing frontend packages...
  pushd frontend
  call npm install
  popd
)

start "Re:List backend (port 5000)" cmd /k "cd /d %~dp0backend && node server.js"
start "Re:List frontend (port 5173)" cmd /k "cd /d %~dp0frontend && npm run dev"

timeout /t 5 >nul
start http://localhost:5173
