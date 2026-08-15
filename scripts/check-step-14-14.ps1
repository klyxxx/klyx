$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$target =
    Join-Path `
        $root `
        "lib\klyx-service-catalog.ts"

if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
    throw "14.14 : catalogue KLYX introuvable."
}

$text =
    [System.IO.File]::ReadAllText(
        $target
    )

foreach ($signal in @(
    "KLYX_UNIVERSAL_SERVICE_CATALOG_14_14",
    "KLYX_ANY_PROFESSION_ALLOWED_14_14",
    "KLYX_SERVICE_CATALOG",
    "KLYX_ALL_SERVICE_NAMES",
    "KLYX_TOTAL_CATEGORIES",
    "KLYX_TOTAL_SERVICES",
    "KLYX_CUSTOM_SERVICE_FALLBACK",
    "Autre métier ou prestation",
    "Baby-sitting",
    "Ménage à domicile",
    "Déménagement",
    "Bricolage général",
    "Plombier",
    "Électricien",
    "Développeur web",
    "Photographe",
    "Coiffeur",
    "Jardinier",
    "Mécanicien automobile",
    "Comptable",
    "Chef à domicile",
    "Agent de sécurité",
    "Cours particuliers",
    "KLYX_ANY_PROFESSION_ALLOWED = true"
)) {
    if (-not $text.Contains($signal)) {
        throw "14.14 : signal catalogue manquant : $signal"
    }
}

Write-Host ""
Write-Host "Tests..."
npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "14.14 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "14.14 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "14.14 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 14.14 CHECK OK"
Write-Host "======================================"
Write-Host "Universal catalog : READY"
Write-Host "Home services     : READY"
Write-Host "Construction      : READY"
Write-Host "Transport         : READY"
Write-Host "Automotive        : READY"
Write-Host "Family            : READY"
Write-Host "Animals           : READY"
Write-Host "Beauty            : READY"
Write-Host "Education         : READY"
Write-Host "Technology        : READY"
Write-Host "Creative          : READY"
Write-Host "Business          : READY"
Write-Host "Events            : READY"
Write-Host "Hospitality       : READY"
Write-Host "Other professions : READY"
Write-Host "Custom fallback   : READY"
Write-Host "Tests             : OK"
Write-Host "TypeScript        : OK"
Write-Host "Build             : OK"
Write-Host "======================================"