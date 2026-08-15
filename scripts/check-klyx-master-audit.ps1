$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$audit =
    Join-Path `
        $root `
        "scripts\run-klyx-master-audit.ps1"

$reportDir =
    Join-Path `
        $root `
        "reports\master-audit"

$json =
    Join-Path `
        $reportDir `
        "KLYX_MASTER_AUDIT.json"

$txt =
    Join-Path `
        $reportDir `
        "KLYX_MASTER_AUDIT.txt"

$testLog =
    Join-Path `
        $reportDir `
        "tests.log"

$tsLog =
    Join-Path `
        $reportDir `
        "typescript.log"

$buildLog =
    Join-Path `
        $reportDir `
        "build.log"

if (
    -not (
        Test-Path `
            -LiteralPath $audit `
            -PathType Leaf
    )
) {
    throw "Master audit script introuvable."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX MASTER AUDIT - SAFE RUN"
Write-Host "======================================"
Write-Host ""

$previousPreference =
    $ErrorActionPreference

try {
    $ErrorActionPreference =
        "Continue"

    powershell `
        -ExecutionPolicy Bypass `
        -File $audit

    $auditExit =
        $LASTEXITCODE
}
finally {
    $ErrorActionPreference =
        $previousPreference
}

Write-Host ""
Write-Host "Audit exit code : $auditExit"
Write-Host ""

foreach ($path in @(
    $json,
    $txt
)) {
    if (
        -not (
            Test-Path `
                -LiteralPath $path `
                -PathType Leaf
        )
    ) {
        throw "Rapport master manquant apres execution : $path"
    }
}

$data =
    Get-Content `
        -LiteralPath $json `
        -Raw |
    ConvertFrom-Json

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX MASTER AUDIT CHECK"
Write-Host "======================================"
Write-Host "Static coverage : $($data.staticEvidenceCoverage)%"
Write-Host "Tests           : $($data.verification.tests)"
Write-Host "TypeScript      : $($data.verification.typescript)"
Write-Host "Build           : $($data.verification.build)"
Write-Host "Push ready      : $($data.push.ready)"
Write-Host "Push blockers   : $($data.push.blockers.Count)"
Write-Host "14.24 evidence  : $($data.stepEvidence[0].evidence)"
Write-Host "14.25 evidence  : $($data.stepEvidence[1].evidence)"
Write-Host "14.26 evidence  : $($data.stepEvidence[2].evidence)"
Write-Host "======================================"

function Show-KlyxLogTail {
    param(
        [string]$Title,
        [string]$Path
    )

    Write-Host ""
    Write-Host "======================================"
    Write-Host $Title
    Write-Host "======================================"

    if (
        Test-Path `
            -LiteralPath $Path `
            -PathType Leaf
    ) {
        Get-Content `
            -LiteralPath $Path `
            -Tail 120
    }
    else {
        Write-Host "Log introuvable : $Path"
    }

    Write-Host "======================================"
}

if (
    $data.verification.tests -ne
    "PASS"
) {
    Show-KlyxLogTail `
        -Title "TESTS ERROR - LAST 120 LINES" `
        -Path $testLog
}

if (
    $data.verification.typescript -ne
    "PASS"
) {
    Show-KlyxLogTail `
        -Title "TYPESCRIPT ERROR - LAST 120 LINES" `
        -Path $tsLog
}

if (
    $data.verification.build -ne
    "PASS"
) {
    Show-KlyxLogTail `
        -Title "BUILD ERROR - LAST 120 LINES" `
        -Path $buildLog
}

Write-Host ""
Write-Host "REPORT JSON:"
Write-Host $json

Write-Host ""
Write-Host "REPORT TXT:"
Write-Host $txt
Write-Host ""

if (
    $data.verification.tests -ne "PASS" -or
    $data.verification.typescript -ne "PASS" -or
    $data.verification.build -ne "PASS"
) {
    Write-Host ""
    Write-Host "AUDIT GENERE, MAIS KLYX NECESSITE UNE CORRECTION."
    exit 2
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX MASTER AUDIT TECHNIQUE OK"
Write-Host "======================================"
Write-Host ""
Write-Host "Le rapport peut maintenant etre analyse."
Write-Host ""

exit 0