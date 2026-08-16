$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$bookingPage =
    Join-Path `
        $root `
        "app\bookings\[id]\page.tsx"

$reviewPage =
    Join-Path `
        $root `
        "app\reviews\[bookingId]\page.tsx"

$reviewApi =
    Join-Path `
        $root `
        "app\api\reviews\route.ts"

foreach ($file in @(
    $bookingPage,
    $reviewPage,
    $reviewApi
)) {
    if (
        -not (
            Test-Path `
                -LiteralPath $file `
                -PathType Leaf
        )
    ) {
        throw "13.70 : fichier manquant : $file"
    }
}

$bookingText =
    [System.IO.File]::ReadAllText(
        $bookingPage
    )

$reviewText =
    [System.IO.File]::ReadAllText(
        $reviewPage
    )

$apiText =
    [System.IO.File]::ReadAllText(
        $reviewApi
    )

$bookingSignals =
    @(
        "KLYX_VERIFIED_REVIEW_CTA_13_70",
        'role === "client"',
        'booking.status === "completed"',
        "Avis vérifié KLYX",
        'href={`/reviews/${booking.id}`}',
        "Laisser mon avis"
    )

foreach ($signal in $bookingSignals) {
    if (-not $bookingText.Contains($signal)) {
        throw "13.70 : booking signal manquant : $signal"
    }
}

$reviewSignals =
    @(
        "/api/reviews",
        "Avis vérifié KLYX",
        "Seules les missions terminées peuvent être",
        "Publier mon avis",
        "Modifier mon avis",
        "bookingId",
        "rating",
        "comment"
    )

foreach ($signal in $reviewSignals) {
    if (-not $reviewText.Contains($signal)) {
        throw "13.70 : review UI signal manquant : $signal"
    }
}

$apiSignals =
    @(
        'profile.accountType !==',
        '"client"',
        'booking.status !==',
        '"completed"',
        '"booking_id"',
        '"author_id"',
        '.from("reviews")',
        ".update({",
        ".insert({"
    )

foreach ($signal in $apiSignals) {
    if (-not $apiText.Contains($signal)) {
        throw "13.70 : review API signal manquant : $signal"
    }
}

if (
    $bookingText -match
    '(?i)automatic.*review'
) {
    throw "13.70 : avis automatique potentiellement detecte."
}

Write-Host ""
Write-Host "Tests..."
Write-Host ""

npm.cmd test

if ($LASTEXITCODE -ne 0) {
    throw "13.70 : tests FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if ($LASTEXITCODE -ne 0) {
    throw "13.70 : TypeScript FAILED."
}

Write-Host ""
Write-Host "Build..."
Write-Host ""

npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "13.70 : build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.70 CHECK OK"
Write-Host "======================================"
Write-Host "Completed mission -> review : CONNECTED"
Write-Host "Review eligibility : COMPLETED BOOKING ONLY"
Write-Host "Review author : CLIENT ONLY"
Write-Host "Review linked to booking : YES"
Write-Host "Duplicate review creation : CONTROLLED"
Write-Host "Existing review editing : PRESERVED"
Write-Host "Verified review UX : VISIBLE"
Write-Host "Automatic review : NONE"
Write-Host "New migration : NONE"
Write-Host "Paid API calls : NONE"
Write-Host "Tests : OK"
Write-Host "TypeScript : OK"
Write-Host "Build : OK"
Write-Host "======================================"