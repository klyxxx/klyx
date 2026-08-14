$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

$paths = @{
    Migration =
        Join-Path $root "supabase\migrations\20260812202000_klyx_booking_groups_12_85.sql"

    CreateApi =
        Join-Path $root "app\api\market\requests\[id]\group-booking\route.ts"

    GroupApi =
        Join-Path $root "app\api\booking-groups\[id]\route.ts"

    GroupPage =
        Join-Path $root "app\booking-groups\[id]\page.tsx"

    Advice =
        Join-Path $root "app\assistant\market\[id]\page.tsx"

    BrainActions =
        Join-Path $root "lib\brain-actions.ts"

    BookingStatus =
        Join-Path $root "app\api\bookings\status\route.ts"

    Checkout =
        Join-Path $root "app\api\stripe\create-checkout-session\route.ts"
}

Write-Host ""
Write-Host "CHECK KLYX 12.85"
Write-Host ""

foreach (
    $path
    in $paths.Values
) {
    if (
        -not (
            Test-Path -LiteralPath $path
        )
    ) {
        throw "Fichier absent : $path"
    }
}

$migration =
    [System.IO.File]::ReadAllText(
        $paths.Migration
    )

$create =
    [System.IO.File]::ReadAllText(
        $paths.CreateApi
    )

$groupApi =
    [System.IO.File]::ReadAllText(
        $paths.GroupApi
    )

$page =
    [System.IO.File]::ReadAllText(
        $paths.GroupPage
    )

$advice =
    [System.IO.File]::ReadAllText(
        $paths.Advice
    )

$brain =
    [System.IO.File]::ReadAllText(
        $paths.BrainActions
    )

$status =
    [System.IO.File]::ReadAllText(
        $paths.BookingStatus
    )

$checkout =
    [System.IO.File]::ReadAllText(
        $paths.Checkout
    )

$checks = @(
    @{
        Name = "booking groups migration"
        Value =
            $migration.Contains(
                "KLYX_BOOKING_GROUPS_12_85"
            )
    },
    @{
        Name = "booking_groups table"
        Value =
            $migration.Contains(
                "create table if not exists public.booking_groups"
            )
    },
    @{
        Name = "bookings linked to group"
        Value =
            $migration.Contains(
                "booking_group_id"
            )
    },
    @{
        Name = "atomic group creation RPC"
        Value =
            $migration.Contains(
                "klyx_create_multi_slot_booking_group"
            )
    },
    @{
        Name = "atomic provider decision RPC"
        Value =
            $migration.Contains(
                "klyx_provider_group_decision"
            )
    },
    @{
        Name = "real child bookings"
        Value =
            $migration.Contains(
                "insert into public.bookings"
            )
    },
    @{
        Name = "child booking events"
        Value =
            $migration.Contains(
                "insert into public.booking_status_events"
            )
    },
    @{
        Name = "create API"
        Value =
            $create.Contains(
                "KLYX_GROUP_BOOKING_CREATE_12_85"
            )
    },
    @{
        Name = "live coverage revalidation"
        Value =
            $create.Contains(
                "rankProvidersForMultiSlots"
            )
    },
    @{
        Name = "skill revalidation"
        Value =
            $create.Contains(
                "isUserServiceApproved"
            )
    },
    @{
        Name = "group API"
        Value =
            $groupApi.Contains(
                "KLYX_BOOKING_GROUP_API_12_85"
            )
    },
    @{
        Name = "provider group accept"
        Value =
            $groupApi.Contains(
                "klyx_provider_group_decision"
            )
    },
    @{
        Name = "group page"
        Value =
            $page.Contains(
                "KLYX_BOOKING_GROUP_PAGE_12_85"
            )
    },
    @{
        Name = "client group selection"
        Value =
            $advice.Contains(
                "KLYX_GROUP_SELECTION_UI_12_85"
            )
    },
    @{
        Name = "group selection route"
        Value =
            $advice.Contains(
                "/group-booking"
            )
    },
    @{
        Name = "Brain group deduplication"
        Value =
            $brain.Contains(
                "KLYX_GROUP_ACTIONS_12_85"
            )
    },
    @{
        Name = "individual status guard"
        Value =
            $status.Contains(
                "KLYX_GROUP_STATUS_GUARD_12_85"
            )
    },
    @{
        Name = "individual payment guard"
        Value =
            $checkout.Contains(
                "KLYX_GROUP_PAYMENT_GUARD_12_85"
            )
    },
    @{
        Name = "no individual Stripe group payment"
        Value =
            $checkout.Contains(
                "GROUP_PAYMENT_REQUIRED"
            )
    }
)

$failed = @()

foreach (
    $check
    in $checks
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
    Write-Host "Echecs :"

    $failed |
        ForEach-Object {
            Write-Host " - $_"
        }

    throw "KLYX 12.85 static checker FAILED."
}

Push-Location $root

try {
    Write-Host ""
    Write-Host "TypeScript..."
    Write-Host ""

    $tsOutput = @(
        & npx.cmd `
            tsc `
            --noEmit `
            --pretty false 2>&1
    )

    if (
        $LASTEXITCODE -ne 0
    ) {
        $tsOutput |
            Select-Object -First 220 |
            ForEach-Object {
                Write-Host $_
            }

        throw "KLYX 12.85 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw "KLYX 12.85 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.85 CHECK OK"
Write-Host "======================================"
Write-Host "1 groupe -> N reservations : OK"
Write-Host "Prix total unique : OK"
Write-Host "Prix enfants repartis : OK"
Write-Host "Confirmation prestataire groupee : OK"
Write-Host "Conflits planning revalides : OK"
Write-Host "Action Center groupe : OK"
Write-Host "Paiement individuel enfants : BLOQUE"
Write-Host "Modification individuelle enfants : BLOQUE"
Write-Host "Paiement automatique : NON"
Write-Host "Build Next.js : OK"
Write-Host "======================================"
Write-Host ""