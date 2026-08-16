$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$target =
    Join-Path `
        $root `
        "app\components\PublicSessionActions.tsx"

if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
    throw "14.01 : PublicSessionActions introuvable."
}

$text =
    [System.IO.File]::ReadAllText(
        $target
    )

$signals = @(
    "KLYX_DUAL_PUBLIC_ENTRY_14_01",
    "KLYX_PUBLIC_COMPACT_ENTRY_14_01",
    "KLYX_CONNECTED_ENTRY_14_01",
    "KLYX_EXISTING_ACCOUNT_ENTRY_14_01",
    'href="/signup?type=client"',
    'href="/signup?type=provider"',
    "J’ai besoin d’un service",
    "Je veux proposer mes services",
    'href="/login"',
    'href="/dashboard"',
    'href="/accounts"',
    "createClient",
    "getUser"
)

foreach ($signal in $signals) {
    if (-not $text.Contains($signal)) {
        throw "14.01 : signal manquant : $signal"
    }
}

if ($text.Contains("[System.IO.File]::WriteAllText")) {
    throw "14.01 : PowerShell injecte dans TSX."
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "14.01 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "14.01 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "14.01 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 14.01 CHECK OK"
Write-Host "======================================"
Write-Host "Client acquisition     : READY"
Write-Host "Provider acquisition   : READY"
Write-Host "Role-aware signup      : READY"
Write-Host "Existing account login : READY"
Write-Host "Connected session      : READY"
Write-Host "Multi-profile entry    : READY"
Write-Host "Tests                  : OK"
Write-Host "TypeScript             : OK"
Write-Host "Build                  : OK"
Write-Host "======================================"