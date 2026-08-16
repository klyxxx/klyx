Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# KLYX_DR_SCHEDULE_PHASE_11C_6D

$Root = "C:\Users\fenjo\Documents\klyx"
$Runner = Join-Path $Root "scripts\backup-klyx-supabase-dr-auto.ps1"

$TaskName = "KLYX DR Daily Backup"
$CurrentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

if (-not (Test-Path -LiteralPath $Runner -PathType Leaf)) {
    throw "Automatic DR runner missing."
}

$PowerShellExe =
    "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"

$Arguments =
    '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' +
    $Runner +
    '"'

$Action =
    New-ScheduledTaskAction `
        -Execute $PowerShellExe `
        -Argument $Arguments `
        -WorkingDirectory $Root

# Tous les jours à 03:30.
$Trigger =
    New-ScheduledTaskTrigger `
        -Daily `
        -At "03:30"

$Principal =
    New-ScheduledTaskPrincipal `
        -UserId $CurrentUser `
        -LogonType Interactive `
        -RunLevel Limited

$Settings =
    New-ScheduledTaskSettingsSet `
        -StartWhenAvailable `
        -WakeToRun `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -MultipleInstances IgnoreNew `
        -ExecutionTimeLimit (
            New-TimeSpan -Hours 2
        )

$Task =
    New-ScheduledTask `
        -Action $Action `
        -Trigger $Trigger `
        -Principal $Principal `
        -Settings $Settings `
        -Description "KLYX encrypted Supabase DB/Auth/Storage disaster-recovery backup to OneDrive."

Register-ScheduledTask `
    -TaskName $TaskName `
    -InputObject $Task `
    -Force |
Out-Null

$Installed =
    Get-ScheduledTask `
        -TaskName $TaskName

$Info =
    Get-ScheduledTaskInfo `
        -TaskName $TaskName

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX DR DAILY TASK INSTALLED"
Write-Host "======================================"
Write-Host "Task              : $TaskName"
Write-Host "User              : $CurrentUser"
Write-Host "State             : $($Installed.State)"
Write-Host "Daily time        : 03:30"
Write-Host "Start when missed : YES"
Write-Host "Wake computer     : YES"
Write-Host "Secrets in task   : NO"
Write-Host "Next run          : $($Info.NextRunTime)"
Write-Host "======================================"
Write-Host "KLYX PHASE 11C.6D COMPLETE"