param(
    [string]$CertificatePath = "",
    [Parameter(Mandatory = $true)]
    [string]$ExpectedCommit,
    [int]$MaxEvidenceAgeHours = 24
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Expected = $ExpectedCommit.Trim().ToLowerInvariant()

if ($Expected -notmatch '^[a-f0-9]{40}$') {
    throw "ExpectedCommit must be a full 40-character Git SHA."
}

if ($MaxEvidenceAgeHours -lt 1 -or $MaxEvidenceAgeHours -gt 168) {
    throw "MaxEvidenceAgeHours must be between 1 and 168."
}

$ReportDirectory = Join-Path $Root ".klyx-local-backup\dr-restore-reports"

if (-not $CertificatePath) {
    $Latest = Get-ChildItem -LiteralPath $ReportDirectory -Filter "KLYX_DR_CERTIFICATE_*.json" -File -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTimeUtc -Descending |
        Select-Object -First 1

    if (-not $Latest) {
        throw "No KLYX DR offsite certificate found."
    }

    $CertificatePath = $Latest.FullName
}

$Resolved = (Resolve-Path -LiteralPath $CertificatePath).Path
$Certificate = Get-Content -LiteralPath $Resolved -Raw | ConvertFrom-Json

if ([string]$Certificate.format -ne "KLYX_DISASTER_RECOVERY_OFFSITE_CERTIFICATE") {
    throw "Unexpected KLYX DR certificate format."
}

if ([int]$Certificate.version -ne 1) {
    throw "Unsupported KLYX DR certificate version."
}

$BackupCommit = ([string]$Certificate.backupGitCommit).Trim().ToLowerInvariant()

if ($BackupCommit -ne $Expected) {
    throw ("Offsite DR certificate commit mismatch. Expected " + $Expected + ", got " + $BackupCommit)
}

if (
    $null -ne $Certificate.expectedGitCommit -and
    [string]$Certificate.expectedGitCommit -and
    ([string]$Certificate.expectedGitCommit).Trim().ToLowerInvariant() -ne $Expected
) {
    throw "Offsite DR certificate expectedGitCommit mismatch."
}

$RequiredTrueFields = @(
    "exactCommitMatch",
    "isolatedLocalRestore",
    "publicDatabaseVerified",
    "authDatabaseVerified",
    "authServiceVerified",
    "storageBinaryIntegrity",
    "storageServiceVerified",
    "restoreTested"
)

foreach ($Field in $RequiredTrueFields) {
    if ([bool]$Certificate.$Field -ne $true) {
        throw "Offsite DR certificate field must be true: $Field"
    }
}

if ([bool]$Certificate.productionWrite -ne $false) {
    throw "Offsite DR certificate reports a production write."
}

if ([bool]$Certificate.linkedCommands -ne $false) {
    throw "Offsite DR certificate reports linked commands."
}

if ([bool]$Certificate.plaintextRetained -ne $false) {
    throw "Offsite DR certificate reports retained plaintext."
}

$Created = [DateTimeOffset]::Parse(
    [string]$Certificate.createdUtc,
    [Globalization.CultureInfo]::InvariantCulture
)

$BackupCreated = [DateTimeOffset]::Parse(
    [string]$Certificate.backupCreatedUtc,
    [Globalization.CultureInfo]::InvariantCulture
)

$Now = [DateTimeOffset]::UtcNow
$EvidenceAge = $Now - $Created

if ($EvidenceAge.TotalHours -lt -0.05 -or $EvidenceAge.TotalHours -gt $MaxEvidenceAgeHours) {
    throw ("Offsite DR certificate is outside the allowed evidence age: " + $MaxEvidenceAgeHours + "h.")
}

$BackupAgeAtRestore = $Created - $BackupCreated

if ($BackupAgeAtRestore.TotalHours -lt -0.05 -or $BackupAgeAtRestore.TotalHours -gt 24) {
    throw "Offsite DR backup did not meet the 24h RPO target at restore time."
}

$CertificateHash = (Get-FileHash -LiteralPath $Resolved -Algorithm SHA256).Hash.ToLowerInvariant()

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX DR OFFSITE CERTIFICATE READY"
Write-Host "======================================"
Write-Host "Commit       : $BackupCommit"
Write-Host "Certificate  : $CertificateHash"
Write-Host "Verified UTC : $($Created.ToString('o'))"
Write-Host "RPO <= 24h   : PASS"
Write-Host "Full restore : PASS"
Write-Host "Production   : READ-ONLY"
Write-Host "======================================"
Write-Host ""
Write-Host "Use these values for the GitHub DR certification workflow:"
Write-Host "offsite_certificate_sha256=$CertificateHash"
Write-Host "offsite_backup_commit=$BackupCommit"
Write-Host "offsite_restore_verified_at=$($Created.ToString('o'))"
