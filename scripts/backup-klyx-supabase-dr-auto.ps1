param(
    [string]$OffsiteDirectory = "C:\Users\fenjo\OneDrive\KLYX-DR",
    [int]$RetentionDays = 30,
    [int]$MinimumCopies = 3
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# KLYX_DR_AUTOMATION_PHASE_11C_7
# Automatic exact-SHA backup + isolated restore verification.
# Secrets remain protected with Windows DPAPI.

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

$RestoreScript =
    Join-Path `
        $Root `
        "scripts\test-klyx-supabase-dr-restore.ps1"

$RetryShimDirectory =
    Join-Path `
        $Root `
        "scripts\dr"

$RetryShim =
    Join-Path `
        $RetryShimDirectory `
        "supabase.cmd"

$RetryScript =
    Join-Path `
        $RetryShimDirectory `
        "invoke-supabase-with-retry.ps1"

$LogDirectory =
    Join-Path `
        $Root `
        ".klyx-local-backup\dr-logs"

$ArchiveDirectory =
    Join-Path `
        $Root `
        ".klyx-local-backup\dr-archives"

$ReportDirectory =
    Join-Path `
        $Root `
        ".klyx-local-backup\dr-restore-reports"

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
        $BackupScript,
        $RestoreScript,
        $RetryShim,
        $RetryScript
    )
) {
    if (
        -not (
            Test-Path `
                -LiteralPath $RequiredPath `
                -PathType Leaf
        )
    ) {
        throw "Required DR file missing: $RequiredPath"
    }
}

$Branch =
    (
        git branch --show-current
    ).Trim()

if ($Branch -ne "main") {
    throw "Automatic DR is restricted to main. Current branch: $Branch"
}

$Commit =
    (
        git rev-parse HEAD
    ).Trim().ToLowerInvariant()

if ($Commit -notmatch '^[a-f0-9]{40}$') {
    throw "Unable to resolve exact Git commit."
}

$ShortCommit =
    $Commit.Substring(
        0,
        8
    )

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
# DOCKER
# Auto-start Docker Desktop when installed but stopped.
# ------------------------------------------------------------

$DockerCommand =
    Get-Command `
        docker `
        -ErrorAction SilentlyContinue

if (-not $DockerCommand) {
    throw "Docker CLI missing."
}

docker info *> $null

if ($LASTEXITCODE -ne 0) {
    $DockerDesktopCandidates = @(
        "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
        "${env:ProgramFiles(x86)}\Docker\Docker\Docker Desktop.exe"
    )

    $DockerDesktopExe =
        $DockerDesktopCandidates |
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

    if (-not $DockerDesktopExe) {
        throw "Docker Desktop executable missing."
    }

    Start-Process `
        -FilePath $DockerDesktopExe

    $DockerReady =
        $false

    for ($Attempt = 0; $Attempt -lt 60; $Attempt++) {
        Start-Sleep `
            -Seconds 2

        docker info *> $null

        if ($LASTEXITCODE -eq 0) {
            $DockerReady =
                $true

            break
        }
    }

    if (-not $DockerReady) {
        throw "Docker Desktop did not become ready automatically."
    }
}

# ------------------------------------------------------------
# SUPABASE RETRY SHIM
# Resolve the real executable before prepending the shim to PATH.
# ------------------------------------------------------------

$LocalSupabase =
    Join-Path `
        $Root `
        "node_modules\.bin\supabase.cmd"

if (
    Test-Path `
        -LiteralPath $LocalSupabase `
        -PathType Leaf
) {
    $RealSupabaseExecutable =
        $LocalSupabase
}
else {
    $ExistingSupabaseCommand =
        Get-Command `
            supabase `
            -ErrorAction SilentlyContinue

    if (-not $ExistingSupabaseCommand) {
        throw "Supabase CLI missing."
    }

    $RealSupabaseExecutable =
        $ExistingSupabaseCommand.Source
}

$OriginalPath =
    $env:PATH

$env:KLYX_DR_REAL_SUPABASE_EXECUTABLE =
    $RealSupabaseExecutable

$env:PATH =
    "$RetryShimDirectory;$OriginalPath"

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
    Write-Host "KLYX AUTOMATIC EXACT-SHA DR"
    Write-Host "======================================"
    Write-Host "Git commit          : $Commit"
    Write-Host "Interactive secrets : NO"
    Write-Host "DPAPI secrets       : PASS"
    Write-Host "OneDrive            : RUNNING"
    Write-Host "Docker              : READY"
    Write-Host "Supabase retry      : ENABLED"

    $BackupStartedUtc =
        (
            Get-Date
        ).ToUniversalTime()

    . $BackupScript `
        -OffsiteDirectory $OffsiteDirectory `
        -RetentionDays $RetentionDays `
        -MinimumCopies $MinimumCopies

    $Archive =
        Get-ChildItem `
            -LiteralPath $ArchiveDirectory `
            -Filter "klyx-dr-*-$ShortCommit.klyxdr" `
            -File `
            -ErrorAction SilentlyContinue |
        Where-Object {
            $_.LastWriteTimeUtc -ge $BackupStartedUtc
        } |
        Sort-Object `
            LastWriteTimeUtc `
            -Descending |
        Select-Object `
            -First 1

    if (-not $Archive) {
        throw (
            "Fresh exact-SHA DR archive missing for commit " +
            "$Commit. Old archives will not be reused."
        )
    }

    Write-Host "Fresh exact-SHA archive : PASS"
    Write-Host "Archive                  : $($Archive.FullName)"

    $RestoreStartedUtc =
        (
            Get-Date
        ).ToUniversalTime()

    . $RestoreScript `
        -ArchivePath $Archive.FullName `
        -ExpectedCommit $Commit

    $Certificate =
        Get-ChildItem `
            -LiteralPath $ReportDirectory `
            -Filter "KLYX_DR_CERTIFICATE_*.json" `
            -File `
            -ErrorAction SilentlyContinue |
        Where-Object {
            $_.LastWriteTimeUtc -ge $RestoreStartedUtc
        } |
        Sort-Object `
            LastWriteTimeUtc `
            -Descending |
        Select-Object `
            -First 1

    if (-not $Certificate) {
        throw "Fresh DR restore certificate missing."
    }

    $CertificateJson =
        Get-Content `
            -LiteralPath $Certificate.FullName `
            -Raw |
        ConvertFrom-Json

    $BackupGitCommit =
        ([string]$CertificateJson.backupGitCommit).Trim().ToLowerInvariant()

    $ExpectedGitCommit =
        ([string]$CertificateJson.expectedGitCommit).Trim().ToLowerInvariant()

    if (
        $BackupGitCommit -ne $Commit -or
        $ExpectedGitCommit -ne $Commit -or
        $CertificateJson.exactCommitMatch -ne $true
    ) {
        throw "Fresh DR certificate failed exact-SHA validation."
    }

    Write-Host ""
    Write-Host "======================================"
    Write-Host "KLYX AUTOMATIC EXACT-SHA DR COMPLETE"
    Write-Host "======================================"
    Write-Host "Backup             : PASS"
    Write-Host "Pooler retry       : PASS"
    Write-Host "Old archive reuse  : NO"
    Write-Host "Isolated restore   : PASS"
    Write-Host "Exact SHA          : PASS"
    Write-Host "Certificate        : $($Certificate.FullName)"
    Write-Host "Production write   : NO"
    Write-Host "======================================"
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

    Remove-Item `
        Env:\KLYX_DR_REAL_SUPABASE_EXECUTABLE `
        -ErrorAction SilentlyContinue

    if ($null -ne $OriginalPath) {
        $env:PATH =
            $OriginalPath
    }
}
