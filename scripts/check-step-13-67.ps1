$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$guard =
    Join-Path `
        $root `
        "app\components\ClientRouteGuard.tsx"

$layout =
    Join-Path `
        $root `
        "app\assistant\market\layout.tsx"

$mainPage =
    Join-Path `
        $root `
        "app\assistant\market\page.tsx"

$advicePage =
    Join-Path `
        $root `
        "app\assistant\market\[id]\page.tsx"

foreach ($file in @(
    $guard,
    $layout,
    $mainPage,
    $advicePage
)) {
    if (
        -not (
            Test-Path `
                -LiteralPath $file `
                -PathType Leaf
        )
    ) {
        throw (
            "13.67 : fichier manquant : " +
            $file
        )
    }
}

# ============================================================
# GUARD CONTRACT
# ============================================================

$guardText =
    [System.IO.File]::ReadAllText(
        $guard
    )

$guardSignals =
    @(
        "/api/profile/me",
        "accountType",
        '"provider"',
        '"/provider/assistant"',
        '"/login"',
        '"allowed"',
        "router.replace"
    )

foreach ($signal in $guardSignals) {
    if (
        -not $guardText.Contains(
            $signal
        )
    ) {
        throw (
            "13.67 : guard signal manquant : " +
            $signal
        )
    }
}

# ============================================================
# SHARED MARKET LAYOUT
# ============================================================

$layoutText =
    [System.IO.File]::ReadAllText(
        $layout
    )

$layoutSignals =
    @(
        'import ClientRouteGuard from "@/app/components/ClientRouteGuard";',
        "MarketClientLayout",
        "<ClientRouteGuard>",
        "{children}",
        "</ClientRouteGuard>"
    )

foreach ($signal in $layoutSignals) {
    if (
        -not $layoutText.Contains(
            $signal
        )
    ) {
        throw (
            "13.67 : layout signal manquant : " +
            $signal
        )
    }
}

# Exactly one canonical wrapper in layout.
if (
    [regex]::Matches(
        $layoutText,
        '<ClientRouteGuard>'
    ).Count -ne 1
) {
    throw "13.67 : ouverture guard layout invalide."
}

if (
    [regex]::Matches(
        $layoutText,
        '</ClientRouteGuard>'
    ).Count -ne 1
) {
    throw "13.67 : fermeture guard layout invalide."
}

# ============================================================
# PRODUCT PAGES STILL EXIST
# ============================================================

$mainText =
    [System.IO.File]::ReadAllText(
        $mainPage
    )

$adviceText =
    [System.IO.File]::ReadAllText(
        $advicePage
    )

if (
    -not $mainText.Contains(
        "/api/brain/respond"
    )
) {
    throw "13.67 : Brain market flow absent."
}

if (
    -not $mainText.Contains(
        "/api/brain/market-publish"
    )
) {
    throw "13.67 : publication flow absent."
}

if (
    -not $adviceText.Contains(
        "/api/brain/market-advice/"
    )
) {
    throw "13.67 : recommendation flow absent."
}

if (
    -not $adviceText.Contains(
        "Confirmer mon choix"
    )
) {
    throw "13.67 : confirmation prestataire absente."
}

Write-Host ""
Write-Host "Automated tests..."
Write-Host ""

npm.cmd test

if (
    $LASTEXITCODE -ne 0
) {
    throw "13.67 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if (
    $LASTEXITCODE -ne 0
) {
    throw "13.67 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Production build..."
Write-Host ""

npm.cmd run build

if (
    $LASTEXITCODE -ne 0
) {
    throw "13.67 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.67 CHECK OK"
Write-Host "======================================"
Write-Host "Market route family : CLIENT ONLY"
Write-Host "/assistant/market : PROTECTED"
Write-Host "/assistant/market/[id] : PROTECTED"
Write-Host "Protection : SHARED LAYOUT"
Write-Host "Provider wrong-route access : REDIRECTED"
Write-Host "Provider destination : /provider/assistant"
Write-Host "Unauthenticated destination : /login"
Write-Host "Brain flow : PRESERVED"
Write-Host "Publication confirmation : PRESERVED"
Write-Host "Provider-choice confirmation : PRESERVED"
Write-Host "Tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build : OK"
Write-Host "======================================"