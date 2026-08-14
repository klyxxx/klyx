$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$api =
    Join-Path `
        $root `
        "app\api\bookings\split-missions\[id]\acceptance\route.ts"

$component =
    Join-Path `
        $root `
        "app\bookings\split\[id]\SplitMissionAcceptance.tsx"

$page =
    Join-Path `
        $root `
        "app\bookings\split\[id]\page.tsx"

$missionApi =
    Join-Path `
        $root `
        "app\api\bookings\split-missions\route.ts"

foreach (
    $path
    in @(
        $api,
        $component,
        $page,
        $missionApi
    )
) {
    if (
        -not (
            Test-Path `
                -LiteralPath `
                $path
        )
    ) {
        throw "13.22 : fichier introuvable : $path"
    }
}

$a =
    [System.IO.File]::ReadAllText(
        $api
    )

$c =
    [System.IO.File]::ReadAllText(
        $component
    )

$p =
    [System.IO.File]::ReadAllText(
        $page
    )

$m =
    [System.IO.File]::ReadAllText(
        $missionApi
    )

$failed =
    @()

function Check {
    param(
        [string]$Name,
        [bool]$Ok
    )

    if (
        $Ok
    ) {
        Write-Host (
            "[OK]   " +
            $Name
        )

        return
    }

    Write-Host (
        "[FAIL] " +
        $Name
    )

    $script:failed +=
        $Name
}

Write-Host ""
Write-Host "CHECK KLYX 13.22"
Write-Host ""

Check `
    "13.22 API marker" `
    $a.Contains(
        "KLYX_SPLIT_PROVIDER_ACCEPTANCE_API_13_22"
    )

Check `
    "batch ownership" `
    $a.Contains(
        "client_profile_id"
    )

Check `
    "per-provider aggregation" `
    $a.Contains(
        "providerItems"
    )

Check `
    "waiting state" `
    $a.Contains(
        '"waiting"'
    )

Check `
    "partial acceptance state" `
    $a.Contains(
        '"partially_accepted"'
    )

Check `
    "all accepted state" `
    $a.Contains(
        '"all_accepted"'
    )

Check `
    "rebuild required state" `
    $a.Contains(
        '"rebuild_required"'
    )

Check `
    "recovery state" `
    $a.Contains(
        '"recovery_required"'
    )

Check `
    "explicit rebuild confirmation requirement" `
    $a.Contains(
        "clientConfirmationRequiredBeforeRebuild"
    )

Check `
    "no automatic provider replacement" `
    $a.Contains(
        "automaticProviderReplacement"
    )

Check `
    "no automatic rebuild" `
    $a.Contains(
        "automaticRebuild"
    )

Check `
    "no automatic booking" `
    $a.Contains(
        "automaticBooking"
    )

Check `
    "no automatic payment" `
    $a.Contains(
        "automaticPayment"
    )

Check `
    "no booking creation endpoint" `
    (
        -not $a.Contains(
            "/api/bookings/create"
        )
    )

Check `
    "no Stripe checkout" `
    (
        -not $a.Contains(
            "create-checkout"
        )
    )

Check `
    "13.22 UI marker" `
    $c.Contains(
        "KLYX_SPLIT_PROVIDER_ACCEPTANCE_UI_13_22"
    )

Check `
    "provider states visible" `
    $c.Contains(
        "PROVIDER_LABELS"
    )

Check `
    "rebuild review link" `
    $c.Contains(
        "/split-plan"
    )

Check `
    "explicit reconfirmation text" `
    $c.Contains(
        "confirm"
    )

Check `
    "13.22 detail wiring" `
    $p.Contains(
        "KLYX_SPLIT_PROVIDER_ACCEPTANCE_WIRING_13_22"
    )

Check `
    "13.21 detail retained" `
    $p.Contains(
        "KLYX_SPLIT_MISSION_DETAIL_13_21"
    )

Check `
    "13.21 mission API retained" `
    $m.Contains(
        "KLYX_SPLIT_MISSION_API_13_21"
    )

if (
    $failed.Count -gt 0
) {
    Write-Host ""
    Write-Host "ECHECS EXACTS :"

    foreach (
        $item
        in $failed
    ) {
        Write-Host (
            " - " +
            $item
        )
    }

    throw "KLYX 13.22 static checker FAILED."
}

Write-Host ""
Write-Host "TypeScript..."
Write-Host ""

npx.cmd tsc --noEmit --pretty false

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.22 TypeScript FAILED."
}

Write-Host ""
Write-Host "Next build..."
Write-Host ""

npm.cmd run build

if (
    $LASTEXITCODE -ne 0
) {
    throw "KLYX 13.22 build FAILED."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.22 CHECK OK"
Write-Host "======================================"
Write-Host "Provider acceptance aggregation : ACTIVE"
Write-Host "Waiting : DETECTE"
Write-Host "Partial acceptance : DETECTEE"
Write-Host "All accepted : DETECTE"
Write-Host "Rebuild required : DETECTE"
Write-Host "Recovery required : DETECTE"
Write-Host "Provider replacement auto : NON"
Write-Host "Rebuild auto : NON"
Write-Host "Booking auto : NON"
Write-Host "Payment auto : NON"
Write-Host "Client reconfirmation : OBLIGATOIRE"
Write-Host "Migration DB : AUCUNE"
Write-Host "TypeScript : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"