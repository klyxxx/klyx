param(
    [string]$OffsiteDirectory = "C:\Users\fenjo\OneDrive\KLYX-DR",
    [int]$RetentionDays = 30,
    [int]$MinimumCopies = 3
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# KLYX_DR_AUTOMATION_PHASE_11C_6C

$Root =
    "C:\Users\fenjo\Documents\klyx"

Set-Location $Root

$SecretRoot =
    Join-Path `
        $env:LOCALAPPDATA `
        "KLYX\DR"

$DatabaseSecretPath =
    Join-Path `
        $SecretRoot `
        "database-password.dpapi"

$DrSecretPath =
    Join-Path `
        $SecretRoot `
        "dr-passphrase.dpapi"

$BackupScript =
    Join-Path `
        $Root `
        "scripts\backup-klyx-supabase-dr.ps1"

$LogDirectory =
    Join-Path `
        $Root `
        ".klyx-local-backup\dr-logs"

New-Item `
    -ItemType Directory `
    -Force `
    -Path $LogDirectory |
Out-Null

$Timestamp =
    Get-Date `
        -Format "yyyyMMdd-HHmmss"

$LogPath =
    Join-Path `
        $LogDirectory `
        "automatic-dr-$Timestamp.log"

foreach (
    $RequiredPath in @(
        $DatabaseSecretPath,
        $DrSecretPath,
        $BackupScript
    )
) {
    if (
        -not (
            Test-Path `
                -LiteralPath $RequiredPath `
                -PathType Leaf
        )
    ) {
        throw "Required DR file missing."
    }
}

# ------------------------------------------------------------
# LOAD WINDOWS DPAPI SECRETS
# Important: Trim removes the newline written by Set-Content.
# ------------------------------------------------------------

try {
    $DatabaseProtectedText =
        (
            Get-Content `
                -LiteralPath $DatabaseSecretPath `
                -Raw
        ).Trim()

    $DrProtectedText =
        (
            Get-Content `
                -LiteralPath $DrSecretPath `
                -Raw
        ).Trim()

    if (-not $DatabaseProtectedText) {
        throw "Database DPAPI secret is empty."
    }

    if (-not $DrProtectedText) {
        throw "DR DPAPI secret is empty."
    }

    $DbSecure =
        ConvertTo-SecureString `
            -String $DatabaseProtectedText

    $DrSecure =
        ConvertTo-SecureString `
            -String $DrProtectedText
}
catch {
    throw (
        "DPAPI secret loading FAILED. " +
        "Secrets must be created and read by the same Windows user. " +
        $_.Exception.Message
    )
}

# ------------------------------------------------------------
# ONEDRIVE
# ------------------------------------------------------------

$OneDrive =
    Get-Process `
        OneDrive `
        -ErrorAction SilentlyContinue

if (-not $OneDrive) {
    $Candidates = @(
        "$env:LOCALAPPDATA\Microsoft\OneDrive\OneDrive.exe",
        "$env:ProgramFiles\Microsoft OneDrive\OneDrive.exe",
        "${env:ProgramFiles(x86)}\Microsoft OneDrive\OneDrive.exe"
    )

    $OneDriveExe =
        $Candidates |
        Where-Object {
            $_ -and
            (
                Test-Path `
                    -LiteralPath $_ `
                    -PathType Leaf
            )
        } |
        Select-Object `
            -First 1

    if (-not $OneDriveExe) {
        throw "OneDrive executable missing."
    }

    Start-Process `
        -FilePath $OneDriveExe

    Start-Sleep `
        -Seconds 10
}

if (
    -not (
        Get-Process `
            OneDrive `
            -ErrorAction SilentlyContinue
    )
) {
    throw "OneDrive client is not running."
}

# ------------------------------------------------------------
# NON-INTERACTIVE READ-HOST OVERRIDE
# ------------------------------------------------------------

function Read-Host {
    param(
        [Parameter(Position = 0)]
        [string]$Prompt,

        [switch]$AsSecureString
    )

    if ($Prompt -eq "Database password") {
        return $script:DbSecure
    }

    if ($Prompt -eq "DR passphrase") {
        return $script:DrSecure
    }

    if ($Prompt -eq "Repeat DR passphrase") {
        return $script:DrSecure
    }

    throw "Unexpected interactive prompt blocked: $Prompt"
}

$TranscriptStarted =
    $false

try {
    Start-Transcript `
        -LiteralPath $LogPath `
        -Force |
    Out-Null

    $TranscriptStarted =
        $true

    Write-Host ""
    Write-Host "======================================"
    Write-Host "KLYX AUTOMATIC DR BACKUP"
    Write-Host "======================================"
    Write-Host "Interactive secrets : NO"
    Write-Host "DPAPI secrets       : PASS"
    Write-Host "OneDrive            : RUNNING"

    . $BackupScript `
        -OffsiteDirectory $OffsiteDirectory `
        -RetentionDays $RetentionDays `
        -MinimumCopies $MinimumCopies

    Write-Host ""
    Write-Host "Automatic DR backup : PASS"
    Write-Host "KLYX PHASE 11C.6C COMPLETE"
}
finally {
    if ($TranscriptStarted) {
        Stop-Transcript |
        Out-Null
    }

    $DbSecure =
        $null

    $DrSecure =
        $null

    $DatabaseProtectedText =
        $null

    $DrProtectedText =
        $null

    Remove-Item `
        Function:\Read-Host `
        -ErrorAction SilentlyContinue

    Remove-Item `
        Env:\SUPABASE_DB_PASSWORD `
        -ErrorAction SilentlyContinue

    Remove-Item `
        Env:\KLYX_DR_PASSPHRASE `
        -ErrorAction SilentlyContinue
}