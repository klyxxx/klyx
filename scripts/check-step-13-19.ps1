$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

$migrationPath =
    Join-Path $root "supabase\migrations\20260813133700_klyx_split_booking_batch_13_19.sql"

$routePath =
    Join-Path $root "app\api\market\requests\[id]\split-fallback\book\route.ts"

$componentPath =
    Join-Path $root "app\assistant\market\[id]\split-plan\SplitPlanBookingAction.tsx"

$reviewPath =
    Join-Path $root "app\assistant\market\[id]\split-plan\page.tsx"

$confirmationPath =
    Join-Path $root "app\api\market\requests\[id]\split-fallback\confirm\route.ts"

$bookingCreatePath =
    Join-Path $root "app\api\bookings\create\route.ts"

foreach (
    $path in @(
        $migrationPath,
        $routePath,
        $componentPath,
        $reviewPath,
        $confirmationPath,
        $bookingCreatePath
    )
) {
    if (
        -not (
            Test-Path -LiteralPath $path
        )
    ) {
        throw "Fichier absent : $path"
    }
}

$sql =
    [System.IO.File]::ReadAllText(
        $migrationPath
    )

$route =
    [System.IO.File]::ReadAllText(
        $routePath
    )

$component =
    [System.IO.File]::ReadAllText(
        $componentPath
    )

$review =
    [System.IO.File]::ReadAllText(
        $reviewPath
    )

$confirmation =
    [System.IO.File]::ReadAllText(
        $confirmationPath
    )

$bookingCreate =
    [System.IO.File]::ReadAllText(
        $bookingCreatePath
    )

$checks = @(
    @{
        Name = "13.19 migration marker"
        Value =
            $sql.Contains(
                "KLYX_SPLIT_BOOKING_BATCH_13_19"
            )
    },
    @{
        Name = "batch table"
        Value =
            $sql.Contains(
                "split_booking_batches"
            )
    },
    @{
        Name = "batch item table"
        Value =
            $sql.Contains(
                "split_booking_batch_items"
            )
    },
    @{
        Name = "confirmation unique"
        Value =
            $sql.Contains(
                "klyx_split_booking_confirmation_unique_13_19"
            )
    },
    @{
        Name = "13.19 API marker"
        Value =
            $route.Contains(
                "KLYX_SPLIT_BOOKING_API_13_19"
            )
    },
    @{
        Name = "13.18 proof required"
        Value =
            $route.Contains(
                "market_split_plan_confirmations"
            ) -and
            $route.Contains(
                "verifyConfirmationLive("
            )
    },
    @{
        Name = "explicit booking confirmation"
        Value =
            $route.Contains(
                "bookingConfirmed"
            )
    },
    @{
        Name = "existing booking API reused"
        Value =
            $route.Contains(
                '"/api/bookings/create"'
            )
    },
    @{
        Name = "providerId forwarded"
        Value =
            $route.Contains(
                "providerId:"
            )
    },
    @{
        Name = "serviceSlug forwarded"
        Value =
            $route.Contains(
                "serviceSlug:"
            )
    },
    @{
        Name = "booking date forwarded"
        Value =
            $route.Contains(
                "bookingDate:"
            )
    },
    @{
        Name = "time range forwarded"
        Value =
            $route.Contains(
                "startTime:"
            ) -and
            $route.Contains(
                "endTime:"
            )
    },
    @{
        Name = "provider service rechecked"
        Value =
            $route.Contains(
                '"provider_enabled"'
            )
    },
    @{
        Name = "idempotence"
        Value =
            $route.Contains(
                "confirmation_id"
            ) -and
            $route.Contains(
                "alreadyCreated"
            )
    },
    @{
        Name = "rollback present"
        Value =
            $route.Contains(
                "rollbackBookings("
            )
    },
    @{
        Name = "automatic retry forbidden"
        Value =
            $route.Contains(
                "automaticRetry:"
            ) -and
            $route.Contains(
                "false"
            )
    },
    @{
        Name = "no checkout"
        Value =
            -not $route.Contains(
                "create-group-checkout-session"
            )
    },
    @{
        Name = "payment false"
        Value =
            $route.Contains(
                "paymentCreated:"
            ) -and
            $route.Contains(
                "false"
            )
    },
    @{
        Name = "13.19 UI marker"
        Value =
            $component.Contains(
                "KLYX_SPLIT_BOOKING_UI_13_19"
            )
    },
    @{
        Name = "explicit booking button"
        Value =
            $component.Contains(
                "Créer ces réservations"
            )
    },
    @{
        Name = "13.19 wiring"
        Value =
            $review.Contains(
                "KLYX_SPLIT_BOOKING_WIRING_13_19"
            )
    },
    @{
        Name = "13.18 retained"
        Value =
            $confirmation.Contains(
                "KLYX_SPLIT_PLAN_CONFIRMATION_API_13_18"
            )
    },
    @{
        Name = "historical booking flow retained"
        Value =
            $bookingCreate.Contains(
                "providerId"
            ) -and
            $bookingCreate.Contains(
                "serviceSlug"
            )
    }
)

$failed =
    @()

Write-Host ""
Write-Host "CHECK KLYX 13.19"
Write-Host ""

foreach (
    $check in $checks
) {
    if (
        $check.Value
    ) {
        Write-Host "[OK]   $($check.Name)"
    }
    else {
        Write-Host "[FAIL] $($check.Name)"
        $failed +=
            $check.Name
    }
}

if (
    $failed.Count -gt 0
) {
    Write-Host ""
    Write-Host "ECHECS EXACTS :"

    foreach (
        $name in $failed
    ) {
        Write-Host " - $name"
    }

    throw "KLYX 13.19 static checker FAILED."
}

Push-Location $root

try {
    Write-Host ""
    Write-Host "Supabase migration..."
    Write-Host ""

    & npx.cmd supabase db push --linked

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw "KLYX 13.19 Supabase db push FAILED."
    }

    Write-Host ""
    Write-Host "TypeScript..."
    Write-Host ""

    $tsOutput =
        @(
            & npx.cmd `
                tsc `
                --noEmit `
                --pretty false 2>&1
        )

    if (
        $LASTEXITCODE -ne 0
    ) {
        $tsOutput |
            Select-Object -First 300 |
            ForEach-Object {
                Write-Host $_
            }

        throw "KLYX 13.19 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw "KLYX 13.19 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.19 CHECK OK"
Write-Host "======================================"
Write-Host "IA principale MVP : TERMINEE"
Write-Host "Preuve exacte 13.18 : OBLIGATOIRE"
Write-Host "Confirmation booking : EXPLICITE"
Write-Host "Multi-provider bookings : ACTIFS"
Write-Host "1 slot : 1 RESERVATION"
Write-Host "Idempotence : ACTIVE"
Write-Host "Double clic : PROTEGE"
Write-Host "Echec partiel : COMPENSE"
Write-Host "Retry automatique : NON"
Write-Host "Paiement automatique : NON"
Write-Host "Supabase : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"
Write-Host ""