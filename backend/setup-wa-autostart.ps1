# ============================================================================
# FILE: backend/setup-wa-autostart.ps1
# Deskripsi: One-time setup script untuk mendaftarkan WA Gateway sebagai
#            Windows Scheduled Task (auto-start saat user login).
#
# Usage:
#   Buka PowerShell sebagai Administrator, lalu jalankan:
#   powershell -ExecutionPolicy Bypass -File "d:\Documents\DwimitraSystem\backend\setup-wa-autostart.ps1"
# ============================================================================

$TaskName = "DwimitraSystem-WAGateway"
$ProjectDir = Split-Path -Parent $PSScriptRoot  # Should resolve to d:\Documents\DwimitraSystem
$BatFile = Join-Path $PSScriptRoot "start-wagateway.bat"

Write-Host ""
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "  DwimitraSystem WA Gateway — Auto-Start Setup"    -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# Check if bat file exists
if (-not (Test-Path $BatFile)) {
    Write-Host "[ERROR] Batch file not found: $BatFile" -ForegroundColor Red
    Write-Host "Pastikan file start-wagateway.bat ada di folder backend/" -ForegroundColor Yellow
    exit 1
}

# Remove existing task if present
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "[INFO] Menghapus task lama '$TaskName'..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# Create the scheduled task
Write-Host "[INFO] Membuat Scheduled Task '$TaskName'..." -ForegroundColor Green

$Action = New-ScheduledTaskAction `
    -Execute "cmd.exe" `
    -Argument "/c `"$BatFile`"" `
    -WorkingDirectory $ProjectDir

$Trigger = New-ScheduledTaskTrigger -AtLogOn

$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 5) `
    -ExecutionTimeLimit (New-TimeSpan -Days 0)  # No time limit — run forever

$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -RunLevel Limited -LogonType Interactive

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Principal $Principal `
    -Description "DwimitraSystem WhatsApp Gateway — auto-start WA reminder service saat login" `
    -Force

Write-Host ""
Write-Host "[SUCCESS] Scheduled Task '$TaskName' berhasil dibuat!" -ForegroundColor Green
Write-Host ""
Write-Host "Detail:" -ForegroundColor Cyan
Write-Host "  Task Name  : $TaskName"
Write-Host "  Trigger    : At Logon (setiap user login)"
Write-Host "  Action     : $BatFile"
Write-Host "  Restart    : 3x retry setiap 5 menit jika crash"
Write-Host ""
Write-Host "Untuk menjalankan sekarang:" -ForegroundColor Yellow
Write-Host "  Start-ScheduledTask -TaskName '$TaskName'"
Write-Host ""
Write-Host "Untuk menghapus task:" -ForegroundColor Yellow
Write-Host "  Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false"
Write-Host ""
