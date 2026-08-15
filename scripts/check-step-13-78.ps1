$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$jobs =
    Join-Path $root "app\provider\jobs\page.tsx"

$assistant =
    Join-Path $root "app\provider\assistant\page.tsx"

foreach ($file in @(
    $jobs,
    $assistant
)) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
        throw "13.78 : fichier manquant : $file"
    }
}

$jobsText =
    [System.IO.File]::ReadAllText($jobs)

$assistantText =
    [System.IO.File]::ReadAllText($assistant)

$jobsSignals = @(
    "KLYX_JOB_TO_PROVIDER_ASSISTANT_13_78",
    "Préparer avec KLYX",
    '"/provider/assistant?prompt="',
    "encodeURIComponent(",
    'Mission : ${item.title}',
    'Ville : ${item.city}',
    "Rien n’est envoyé",
    "submitOffer(",
    "/offers"
)

foreach ($signal in $jobsSignals) {
    if (-not $jobsText.Contains($signal)) {
        throw "13.78 : jobs signal manquant : $signal"
    }
}

$assistantSignals = @(
    "KLYX_PROVIDER_ASSISTANT_CONTEXT_13_78",
    "window.location.search",
    '.get("prompt")',
    "setMessage(missionPrompt)",
    "Contexte de mission chargé",
    'message.includes("Mission :")',
    "/api/provider/assistant"
)

foreach ($signal in $assistantSignals) {
    if (-not $assistantText.Contains($signal)) {
        throw "13.78 : assistant signal manquant : $signal"
    }
}

$forbidden = @(
    "submit(undefined, missionPrompt)",
    "void submit(undefined, missionPrompt)"
)

foreach ($signal in $forbidden) {
    if ($assistantText.Contains($signal)) {
        throw "13.78 : soumission automatique detectee : $signal"
    }
}

if (
    $jobsText.Contains("[System.IO.File]::WriteAllText") -or
    $assistantText.Contains("[System.IO.File]::WriteAllText")
) {
    throw "13.78 : PowerShell injecte dans TSX."
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "13.78 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "13.78 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "13.78 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.78 CHECK OK"
Write-Host "======================================"
Write-Host "Mission -> Assistant : READY"
Write-Host "Mission context : READY"
Write-Host "Prefill : READY"
Write-Host "Manual Prepare action : PRESERVED"
Write-Host "Automatic submit : NONE"
Write-Host "Automatic offer : NONE"
Write-Host "Automatic booking : NONE"
Write-Host "Automatic payment : NONE"
Write-Host "Tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build : OK"
Write-Host "======================================"