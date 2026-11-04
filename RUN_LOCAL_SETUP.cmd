@echo off
setlocal
title LEARN Afghan Local Setup
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File "%~dp0tools\setup-windows.ps1"
echo.
echo Press any key to close this window.
pause >nul

