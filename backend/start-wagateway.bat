@echo off
:: ============================================================================
:: FILE: backend/start-wagateway.bat
:: Deskripsi: Menjalankan WhatsApp Gateway Service sebagai background process
::            dengan auto-restart jika crash. Cocok untuk Windows Scheduled Task.
:: ============================================================================

title DwimitraSystem WA Gateway
cd /d "%~dp0\.."

:loop
echo [%date% %time%] Starting WA Gateway Service...
node backend/wagateway.js
echo [%date% %time%] WA Gateway crashed or stopped. Restarting in 15 seconds...
timeout /t 15 /nobreak >nul
goto loop
