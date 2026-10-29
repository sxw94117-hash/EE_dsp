@echo off
setlocal
cd /d "%~dp0"
set PORT=8000

echo.
echo LAN preview: same Wi-Fi only.
echo Your IPv4 address:
powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } | Select-Object -First 1 -ExpandProperty IPAddress)"
echo.
echo Open http://YOUR-IP:%PORT%/ on other devices.
echo Allow Windows Firewall access for Private networks if prompted.
echo Close this window to stop.
echo.

where py >nul 2>nul
if not errorlevel 1 goto use_py
where python >nul 2>nul
if not errorlevel 1 goto use_python

echo Python was not found. Install Python 3 first.
pause
exit /b 1

:use_py
start "DSP LAN server" cmd /k py -3 -m http.server %PORT% --bind 0.0.0.0
timeout /t 2 >nul
start "" "http://127.0.0.1:%PORT%/"
exit /b

:use_python
start "DSP LAN server" cmd /k python -m http.server %PORT% --bind 0.0.0.0
timeout /t 2 >nul
start "" "http://127.0.0.1:%PORT%/"
exit /b
