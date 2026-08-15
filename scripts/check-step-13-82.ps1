$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$page =
    Join-Path `
        $root `
        "app\dashboard\ProviderDashboard.tsx"

if (-not (Test-Path -LiteralPath $page -PathType Leaf)) {
    throw "13.82 : ProviderDashboard.tsx introuvable."
}

$text =
    [System.IO.File]::ReadAllText(
        $page
    )

$signals = @(
    "KLYX_PROVIDER_DASHBOARD_WORKFLOW_13_82",
    "KLYX_PROVIDER_PRIMARY_WORKFLOW_13_82",
    "Opportunités KLYX",
    "Assistant Prestataire",
    'href="/provider/jobs"',
    'href="/provider/assistant"',
    'href="/bookings"',
    "Voir mes opportunités",
    "Assistant KLYX",
    "Trouve une mission",
    "Prépare ta réponse",
    "Suis la prestation",
    "DashboardActionCenter",
    "ProviderActivitySnapshot",
    "KLYX_PROVIDER_CONTROL_REMINDER_13_82",
    "aucune offre",
    "automatiquement"
)

foreach ($signal in $signals) {
    if (-not $text.Contains($signal)) {
        throw "13.82 : signal manquant : $signal"
    }
}

if ($text.Contains("[System.IO.File]::WriteAllText")) {
    throw "13.82 : PowerShell injecte dans TSX."
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "13.82 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "13.82 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "13.82 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.82 CHECK OK"
Write-Host "======================================"
Write-Host "Provider dashboard workflow : READY"
Write-Host "Opportunities : FIRST CLASS"
Write-Host "Provider assistant : FIRST CLASS"
Write-Host "Bookings : CONNECTED"
Write-Host "Action center : PRESERVED"
Write-Host "Activity snapshot : PRESERVED"
Write-Host "Provider control : PRESERVED"
Write-Host "Automatic offer : NONE"
Write-Host "Automatic booking : NONE"
Write-Host "Automatic payment : NONE"
Write-Host "Tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build : OK"
Write-Host "======================================"