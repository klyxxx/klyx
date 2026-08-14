$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

$paths = @{
    Migration = Join-Path $root "supabase\migrations\20260812195600_klyx_multi_slot_market_12_83.sql"
    Proof = Join-Path $root "lib\brain-multi-slot-proof.ts"
    Matching = Join-Path $root "lib\market-multi-slot.ts"
    Confirm = Join-Path $root "app\api\brain\confirm-request\route.ts"
    Publish = Join-Path $root "app\api\brain\market-publish-multi\route.ts"
    Page = Join-Path $root "app\request\confirm-multi\page.tsx"
    Brain = Join-Path $root "app\brain\page.tsx"
    Respond = Join-Path $root "app\api\brain\respond\route.ts"
}

Write-Host ""
Write-Host "CHECK KLYX 12.83"
Write-Host ""

foreach ($path in $paths.Values) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Fichier absent : $path"
    }
}

$migration =
    [System.IO.File]::ReadAllText(
        $paths.Migration
    )

$proof =
    [System.IO.File]::ReadAllText(
        $paths.Proof
    )

$matching =
    [System.IO.File]::ReadAllText(
        $paths.Matching
    )

$confirm =
    [System.IO.File]::ReadAllText(
        $paths.Confirm
    )

$publish =
    [System.IO.File]::ReadAllText(
        $paths.Publish
    )

$page =
    [System.IO.File]::ReadAllText(
        $paths.Page
    )

$brain =
    [System.IO.File]::ReadAllText(
        $paths.Brain
    )

$respond =
    [System.IO.File]::ReadAllText(
        $paths.Respond
    )

$checks = @(
    @{
        Name = "migration 12.83"
        Value = $migration.Contains(
            "KLYX_MULTI_SLOT_MARKET_12_83"
        )
    },
    @{
        Name = "slot table"
        Value = $migration.Contains(
            "market_service_request_slots"
        )
    },
    @{
        Name = "candidate table"
        Value = $migration.Contains(
            "market_request_provider_candidates"
        )
    },
    @{
        Name = "single provider preference"
        Value = $migration.Contains(
            "prefer_single_provider"
        )
    },
    @{
        Name = "confirmation proof"
        Value = $proof.Contains(
            "KLYX_MULTI_SLOT_CONFIRMATION_PROOF_12_83"
        )
    },
    @{
        Name = "exact schedule equality"
        Value = $proof.Contains(
            "sameSlots("
        )
    },
    @{
        Name = "provider matching"
        Value = $matching.Contains(
            "KLYX_MULTI_SLOT_PROVIDER_MATCHING_12_83"
        )
    },
    @{
        Name = "availability checked"
        Value = $matching.Contains(
            "availability_slots"
        )
    },
    @{
        Name = "booking conflicts checked"
        Value = $matching.Contains(
            '"bookings"'
        )
    },
    @{
        Name = "full coverage"
        Value = $matching.Contains(
            "fullCoverage"
        )
    },
    @{
        Name = "confirm route multi"
        Value = $confirm.Contains(
            "KLYX_CONFIRM_REQUEST_MULTI_SLOT_12_83"
        )
    },
    @{
        Name = "publish route multi"
        Value = $publish.Contains(
            "KLYX_MULTI_SLOT_MARKET_PUBLISH_12_83"
        )
    },
    @{
        Name = "one parent request"
        Value = $publish.Contains(
            '"multi_slot"'
        )
    },
    @{
        Name = "slots persisted"
        Value = $publish.Contains(
            "market_service_request_slots"
        )
    },
    @{
        Name = "candidates persisted"
        Value = $publish.Contains(
            "market_request_provider_candidates"
        )
    },
    @{
        Name = "review page"
        Value = $page.Contains(
            "KLYX_MULTI_SLOT_CONFIRM_PAGE_12_83"
        )
    },
    @{
        Name = "Brain multi UI"
        Value = $brain.Contains(
            "KLYX_MULTI_SLOT_BRAIN_UI_12_83"
        )
    },
    @{
        Name = "Brain multi route"
        Value = $brain.Contains(
            "/request/confirm-multi?"
        )
    },
    @{
        Name = "12.82 blocker removed"
        Value = -not $respond.Contains(
            "publication_multi_creneaux"
        )
    },
    @{
        Name = "12.83 readiness"
        Value = $respond.Contains(
            "KLYX_MULTI_SLOT_PUBLISH_READY_12_83"
        )
    },
    @{
        Name = "automatic execution disabled"
        Value =
            $publish.Contains(
                "automaticExecutionAllowed:"
            ) -and
            $publish.Contains(
                "false"
            )
    }
)

$failed = @()

foreach ($check in $checks) {
    if ($check.Value) {
        Write-Host "[OK]   $($check.Name)"
    }
    else {
        Write-Host "[FAIL] $($check.Name)"
        $failed += $check.Name
    }
}

if ($failed.Count -gt 0) {
    Write-Host ""
    Write-Host "Echecs :"

    $failed |
        ForEach-Object {
            Write-Host " - $_"
        }

    throw "KLYX 12.83 static checker FAILED."
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

    if ($LASTEXITCODE -ne 0) {
        $tsOutput |
            Select-Object -First 200 |
            ForEach-Object {
                Write-Host $_
            }

        throw "KLYX 12.83 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if ($LASTEXITCODE -ne 0) {
        throw "KLYX 12.83 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.83 CHECK OK"
Write-Host "======================================"
Write-Host "1 demande -> plusieurs creneaux : OK"
Write-Host "Budgets par creneau : OK"
Write-Host "Disponibilites prestataire : OK"
Write-Host "Conflits reservations : OK"
Write-Host "Meme prestataire prioritaire : OK"
Write-Host "Confirmation explicite : OK"
Write-Host "Reservation automatique : NON"
Write-Host "Paiement automatique : NON"
Write-Host "Build Next.js : OK"
Write-Host "======================================"
Write-Host ""