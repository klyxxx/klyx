@echo off
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0invoke-supabase-with-retry.ps1" %*
exit /b %ERRORLEVEL%
