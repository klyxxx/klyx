$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$target =
    Join-Path `
        $root `
        "app\dashboard\page.tsx"

if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
    throw "14.04 : dashboard/page.tsx introuvable."
}

$text =
    [System.IO.File]::ReadAllText(
        $target
    )

$signals = @(
    "KLYX_DASHBOARD_RESUME_CENTER_14_04",
    "KLYX_DASHBOARD_CONTROL_REMINDER_14_04",
    "Reprendre mon parcours",
    "Trouve ta prochaine mission.",
    "Organise ton prochain besoin.",
    'href="/provider/jobs"',
    'href="/provider"',
    'href="/assistant/market"',
    'href="/search"',
    "Voir mes opportunités",
    "Gérer mon activité",
    "Organiser un besoin",
    "Chercher moi-même",
    "Aucune offre n’est envoyée automatiquement",
    "ne publie, ne réserve et ne paie rien",
    "AccountSwitcher",
    "ClientDashboard",
    "ProviderDashboard",
    'profile.accountType === "provider"'
)

foreach ($signal in $signals) {
    if (-not $text.Contains($signal)) {
        throw "14.04 : signal manquant : $signal"
    }
}

if ($text.Contains("[System.IO.File]::WriteAllText")) {
    throw "14.04 : PowerShell injecte dans TSX."
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "14.04 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "14.04 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "14.04 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 14.04 CHECK OK"
Write-Host "======================================"
Write-Host "Dashboard resume center : READY"
Write-Host "Client journey resume   : READY"
Write-Host "Provider journey resume : READY"
Write-Host "Profile switching       : PRESERVED"
Write-Host "Role routing            : VERIFIED"
Write-Host "Automatic publication   : NONE"
Write-Host "Automatic provider offer: NONE"
Write-Host "Tests                   : OK"
Write-Host "TypeScript              : OK"
Write-Host "Build                   : OK"
Write-Host "======================================"