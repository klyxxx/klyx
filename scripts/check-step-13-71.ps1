$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$page =
    Join-Path `
        $root `
        "app\reviews\[bookingId]\page.tsx"

$api =
    Join-Path `
        $root `
        "app\api\reviews\route.ts"

foreach ($file in @($page, $api)) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
        throw "13.71 : fichier manquant : $file"
    }
}

$pageText =
    [System.IO.File]::ReadAllText(
        $page
    )

$apiText =
    [System.IO.File]::ReadAllText(
        $api
    )

$pageSignals =
    @(
        "KLYX_REVIEW_COMPLETION_13_71",
        "setJustSaved(true)",
        "Merci pour ton avis.",
        "Avis vérifié",
        "La boucle KLYX est terminée.",
        'href={`/providers/${providerId}`}',
        'href="/bookings"',
        'href="/assistant/market"',
        "Organiser un nouveau service",
        "Aucune nouvelle réservation ou dépense n’est déclenchée automatiquement."
    )

foreach ($signal in $pageSignals) {
    if (-not $pageText.Contains($signal)) {
        throw "13.71 : page signal manquant : $signal"
    }
}

$apiSignals =
    @(
        "recalculateProviderScores",
        "await recalculateProviderScores(",
        '.from("reviews")',
        '"completed"',
        '"client"',
        '"user_notifications"',
        '"Nouvel avis recu"'
    )

foreach ($signal in $apiSignals) {
    if (-not $apiText.Contains($signal)) {
        throw "13.71 : API signal manquant : $signal"
    }
}

if (
    $pageText -match
    'window\.setTimeout[\s\S]{0,400}router\.push'
) {
    throw "13.71 : redirection automatique encore presente."
}

Write-Host ""
Write-Host "Tests..."
Write-Host ""

npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "13.71 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "13.71 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
Write-Host ""

npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "13.71 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.71 CHECK OK"
Write-Host "======================================"
Write-Host "Verified review saved : YES"
Write-Host "Provider score recalculation : CONNECTED"
Write-Host "Provider notification : CONNECTED"
Write-Host "Automatic redirect : NONE"
Write-Host "Mission closure UX : READY"
Write-Host "Next user action : EXPLICIT"
Write-Host "Automatic transaction : NONE"
Write-Host "Tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build : OK"
Write-Host "======================================"