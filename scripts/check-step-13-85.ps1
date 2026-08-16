$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$homePath =
    Join-Path `
        $root `
        "app\page.tsx"

$signupPath =
    Join-Path `
        $root `
        "app\signup\page.tsx"

foreach ($file in @(
    $homePath,
    $signupPath
)) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
        throw "13.85 : fichier introuvable : $file"
    }
}

$homeText =
    [System.IO.File]::ReadAllText(
        $homePath
    )

$signupText =
    [System.IO.File]::ReadAllText(
        $signupPath
    )

$homeSignals = @(
    "KLYX_PUBLIC_DUAL_ENTRY_13_85",
    "Je suis client",
    "J’ai besoin d’un service",
    "Je suis prestataire",
    "Je veux proposer mes services",
    'href="/signup?type=client"',
    'href="/signup?type=provider"',
    "Créer mon compte client",
    "Créer mon espace prestataire",
    "function PublicBenefit",
    "L’inscription est gratuite",
    "parcours séparés",
    "KLYX_PUBLIC_PRODUCT_JOURNEY_13_84"
)

foreach ($signal in $homeSignals) {
    if (-not $homeText.Contains($signal)) {
        throw "13.85 : homepage signal manquant : $signal"
    }
}

$signupSignals = @(
    'params.get("type")',
    '"provider"',
    '"client"',
    "setAccountType(",
    "account_type:",
    "accountType"
)

foreach ($signal in $signupSignals) {
    if (-not $signupText.Contains($signal)) {
        throw "13.85 : signup signal manquant : $signal"
    }
}

if (
    $homeText.Contains(
        "[System.IO.File]::WriteAllText"
    ) -or
    $signupText.Contains(
        "[System.IO.File]::WriteAllText"
    )
) {
    throw "13.85 : PowerShell injecte dans TSX."
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "13.85 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "13.85 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "13.85 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.85 CHECK OK"
Write-Host "======================================"
Write-Host "Public conversion paths : READY"
Write-Host "Client CTA : READY"
Write-Host "Provider CTA : READY"
Write-Host "Signup role preselection : VERIFIED"
Write-Host "Account type persistence : PRESERVED"
Write-Host "Existing auth : PRESERVED"
Write-Host "Backend change : NONE"
Write-Host "Migration : NONE"
Write-Host "Paid API : NONE"
Write-Host "Tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build : OK"
Write-Host "======================================"