$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$runner =
    Join-Path `
        $root `
        "scripts\run-step-13-52-brain-llm-foundation-audit.ps1"

$manifestPath =
    Join-Path `
        $root `
        "reports\brain-llm-foundation-audit-13-52.json"

Write-Host ""
Write-Host "KLYX 13.52 Brain LLM foundation audit..."
Write-Host ""

powershell `
    -ExecutionPolicy Bypass `
    -File $runner

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.52 runner FAILED."
}

$data =
    Get-Content `
        -LiteralPath `
        $manifestPath `
        -Raw |
    ConvertFrom-Json

if (
    $data.AuditComplete -ne
    $true
) {
    throw "13.52 : audit incomplet."
}

if (
    $data.AuditOnly -ne
    $true
) {
    throw "13.52 : audit-only invalide."
}

if (
    [int]$data.SourceFilesModified -ne
    0
) {
    throw "13.52 : sources modifiees."
}

if (
    [int]$data.RoutesModified -ne
    0
) {
    throw "13.52 : routes modifiees."
}

if (
    $data.DatabaseModified -ne
    $false
) {
    throw "13.52 : database modifiee."
}

if (
    $data.ProductionModified -ne
    $false
) {
    throw "13.52 : production modifiee."
}

Write-Host ""
Write-Host "Automated tests..."
Write-Host ""

npm.cmd test

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.52 tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.52 TypeScript FAILED."
}

Write-Host ""
Write-Host "Next build..."
Write-Host ""

npm.cmd run build

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.52 build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.52 CHECK OK"
Write-Host "======================================"
Write-Host (
    "Brain-related files : " +
    $data.BrainRelatedFileCount
)
Write-Host (
    "Brain API routes : " +
    $data.BrainApiRouteCount
)
Write-Host (
    "Existing LLM signal files : " +
    $data.LlmSignalFileCount
)
Write-Host (
    "Rule-heavy files : " +
    $data.RuleHeavyFileCount
)
Write-Host (
    "Confirmation guard files : " +
    $data.ConfirmationGuardFileCount
)
Write-Host (
    "Memory-related files : " +
    $data.MemoryRelatedFileCount
)
Write-Host "Application behavior changed : NON"
Write-Host "Database changed : NON"
Write-Host "Automated tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"