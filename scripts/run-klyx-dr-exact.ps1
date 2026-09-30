param(
    [int]$SupabaseMaxAttempts = 4,
    [int]$RetryBaseSeconds = 2
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = "C:\Users\fenjo\Documents\klyx"
Set-Location $Root

$Branch = (git branch --show-current).Trim()
if ($Branch -ne "main") {
    throw "DR exact certification must run from main. Current branch: $Branch"
}

$ExpectedCommit = (git rev-parse HEAD).Trim().ToLowerInvariant()
if ($ExpectedCommit -notmatch '^[a-f0-9]{40}$') {
    throw "Unable to determine exact 40-character Git SHA."
}

$StartedUtc = (Get-Date).ToUniversalTime()
$ShortCommit = $ExpectedCommit.Substring(0, 8)
$ArchiveDirectory = Join-Path $Root ".klyx-local-backup\dr-archives"

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX EXACT-SHA DR ORCHESTRATOR"
Write-Host "======================================"
Write-Host "Expected commit : $ExpectedCommit"
Write-Host "Branch          : $Branch"
Write-Host ""

& (Join-Path $PSScriptRoot "backup-klyx-supabase-dr.ps1") `
    -SupabaseMaxAttempts $SupabaseMaxAttempts `
    -RetryBaseSeconds $RetryBaseSeconds

if (-not $?) {
    throw "DR backup script failed. Restore will not run."
}

$Archive = Get-ChildItem `
    -LiteralPath $ArchiveDirectory `
    -Filter "*-$ShortCommit.klyxdr" `
    -File `
    -ErrorAction SilentlyContinue |
    Where-Object {
        $_.LastWriteTimeUtc -ge $StartedUtc.AddSeconds(-5)
    } |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1

if (-not $Archive) {
    throw (
        "No new DR archive was created for exact commit " +
        "$ExpectedCommit. Refusing to fall back to an older archive."
    )
}

$ChecksumPath = "$($Archive.FullName).sha256"
if (-not (Test-Path -LiteralPath $ChecksumPath -PathType Leaf)) {
    throw "Exact-SHA DR archive checksum missing: $ChecksumPath"
}

Write-Host ""
Write-Host "Exact archive    : $($Archive.FullName)"
Write-Host "Old archive use  : FORBIDDEN"
Write-Host ""

& (Join-Path $PSScriptRoot "test-klyx-supabase-dr-restore.ps1") `
    -ArchivePath $Archive.FullName `
    -ExpectedCommit $ExpectedCommit

if (-not $?) {
    throw "Exact-SHA isolated restore failed."
}

$ReportDirectory = Join-Path $Root ".klyx-local-backup\dr-restore-reports"
$Certificate = Get-ChildItem `
    -LiteralPath $ReportDirectory `
    -Filter "KLYX_DR_CERTIFICATE_*.json" `
    -File `
    -ErrorAction SilentlyContinue |
    Where-Object {
        $_.LastWriteTimeUtc -ge $StartedUtc.AddSeconds(-5)
    } |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1

if (-not $Certificate) {
    throw "Restore completed without a new DR certificate."
}

$CertificateText = [IO.File]::ReadAllText($Certificate.FullName).TrimStart([char]0xFEFF)
$CertificateJson = $CertificateText | ConvertFrom-Json

$CertificateCommit = ""
if ($CertificateJson.PSObject.Properties.Name -contains "backupGitCommit") {
    $CertificateCommit = ([string]$CertificateJson.backupGitCommit).Trim().ToLowerInvariant()
}
elseif ($CertificateJson.PSObject.Properties.Name -contains "backup" -and $CertificateJson.backup.PSObject.Properties.Name -contains "gitCommit") {
    $CertificateCommit = ([string]$CertificateJson.backup.gitCommit).Trim().ToLowerInvariant()
}

if ($CertificateCommit -and $CertificateCommit -ne $ExpectedCommit) {
    throw "Generated DR certificate commit mismatch."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX EXACT-SHA DR COMPLETE"
Write-Host "======================================"
Write-Host "Commit      : $ExpectedCommit"
Write-Host "Archive     : $($Archive.FullName)"
Write-Host "Certificate : $($Certificate.FullName)"
Write-Host "======================================"
