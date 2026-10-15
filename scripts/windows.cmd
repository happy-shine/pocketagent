@echo off
setlocal
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 or newer is required. Install it and reopen this terminal.
  exit /b 1
)
if not exist "%~dp0..\dist\index.js" (
  echo Build PocketAgent first: npm.cmd ci then npm.cmd run build
  exit /b 1
)
if "%~1"=="" (
  node "%~dp0..\dist\index.js" start
) else (
  node "%~dp0..\dist\index.js" %*
)
exit /b %errorlevel%
