$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$target =
    Join-Path `
        $root `
        "app\onboarding\FirstProfileSetup.tsx"

if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
    throw "14.05 : FirstProfileSetup.tsx introuvable."
}

$text =
    [System.IO.File]::ReadAllText(
        $target
    )

$signals = @(
    "KLYX_FIRST_PROFILE_ROLE_LOCK_14_05",
    "KLYX_FIRST_PROFILE_ROLE_CONFIRMATION_14_05",
    "roleChoiceUnlocked",
    "setRoleChoiceUnlocked",
    "Type de premier profil",
    "Ce choix vient de ton inscription.",
    "Changer le type de profil",
    "Verrouiller le choix",
    "disabled={!roleChoiceUnlocked}",
    "if (!roleChoiceUnlocked)",
    "initialAccountType",
    "/api/profiles/manage",
    "serviceId",
    "Créer mon espace prestataire",
    "Créer mon espace client",
    "Premier métier"
)

foreach ($signal in $signals) {
    if (-not $text.Contains($signal)) {
        throw "14.05 : signal manquant : $signal"
    }
}

if ($text -notmatch 'useState<AccountType>\s*\(\s*initialAccountType\s*\)') {
    throw "14.05 : initialAccountType n'alimente plus accountType."
}

if ($text.Contains("[System.IO.File]::WriteAllText")) {
    throw "14.05 : PowerShell injecte dans TSX."
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "14.05 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "14.05 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "14.05 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 14.05 CHECK OK"
Write-Host "======================================"
Write-Host "Signup intent           : PRESERVED"
Write-Host "Initial role            : LOCKED"
Write-Host "Explicit role change    : READY"
Write-Host "Client creation         : READY"
Write-Host "Provider creation       : READY"
Write-Host "First provider service  : READY"
Write-Host "Profiles API            : PRESERVED"
Write-Host "Tests                   : OK"
Write-Host "TypeScript              : OK"
Write-Host "Build                   : OK"
Write-Host "======================================"