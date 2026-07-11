@echo off
cd /d "%~dp0"
node build-catalog.mjs
if errorlevel 1 pause
echo.
echo Done. Commit catalog.json + descriptions\ when ready.
pause
