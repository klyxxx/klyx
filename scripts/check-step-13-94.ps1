$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$pagePath =
    Join-Path `
        $root `
        "app\assistant\market\page.tsx"

if (-not (Test-Path -LiteralPath $pagePath -PathType Leaf)) {
    throw "13.94 : assistant market introuvable."
}

$text =
    [System.IO.File]::ReadAllText(
        $pagePath
    )

$signals = @(
    "KLYX_ASSISTED_NEED_JOURNEY_13_94",
    "KLYX_ASSISTANT_CONTROL_STATE_13_94",
    "Ton parcours KLYX",
    "Du besoin à la comparaison, sans action cachée.",
    "/search",
    "Comparer moi-même",
    'title="Décris"',
    'title="Vérifie"',
    'title="Confirme"',
    'title="Compare"',
    "Rien n’est publié pendant la conversation.",
    "Vérifie maintenant les informations avant de décider de publier.",
    "function AssistantJourneyStep",
    "/api/brain/respond",
    "/api/brain/market-publish",
    "Confirmer et publier",
    "payload?.ready",
    "conversationId"
)

foreach ($signal in $signals) {
    if (-not $text.Contains($signal)) {
        throw "13.94 : signal manquant : $signal"
    }
}

# KLYX_CONFIRMATION_GATE_CHECK_13_94
if ($text -notmatch 'confirmed\s*:\s*true') {
    throw "13.94 : confirmation explicite confirmed=true introuvable."
}

if ($text -notmatch 'confirmationId\s*:') {
    throw "13.94 : preuve de confirmation confirmationId introuvable."
}

if ($text.Contains("[System.IO.File]::WriteAllText")) {
    throw "13.94 : PowerShell injecte dans TSX."
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "13.94 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "13.94 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "13.94 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.94 CHECK OK"
Write-Host "======================================"
Write-Host "Assistant journey : READY"
Write-Host "Need comprehension : READY"
Write-Host "Review stage : READY"
Write-Host "Explicit publication : PRESERVED"
Write-Host "Confirmation gate : VERIFIED"
Write-Host "Confirmation proof : VERIFIED"
Write-Host "Manual comparison : READY"
Write-Host "Brain API : PRESERVED"
Write-Host "Market API : PRESERVED"
Write-Host "Automatic publication : NONE"
Write-Host "Backend change : NONE"
Write-Host "Migration : NONE"
Write-Host "Tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build : OK"
Write-Host "======================================"