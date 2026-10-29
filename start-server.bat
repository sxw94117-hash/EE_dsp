@echo off
setlocal
cd /d "%~dp0"
set PORT=8000

where py >nul 2>nul
if not errorlevel 1 goto use_py
where python >nul 2>nul
if not errorlevel 1 goto use_python

echo.
echo Python was not found.
echo Install Python 3 from https://www.python.org/downloads/
echo or use the VS Code "Live Server" extension.
echo.
pause
exit /b 1

:use_py
start "DSP local server" cmd /k py -3 -m http.server %PORT% --bind 127.0.0.1
timeout /t 2 >nul
start "" "http://127.0.0.1:%PORT%/"
exit /b

:use_python
start "DSP local server" cmd /k python -m http.server %PORT% --bind 127.0.0.1
timeout /t 2 >nul
start "" "http://127.0.0.1:%PORT%/"
exit /b
