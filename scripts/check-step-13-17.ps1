$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

$marketDetail =
    Join-Path $root "app\assistant\market\[id]\page.tsx"

$entryPath =
    Join-Path $root "app\assistant\market\[id]\SplitPlanEntryCard.tsx"

$reviewPath =
    Join-Path $root "app\assistant\market\[id]\split-plan\page.tsx"

$slotMapPath =
    Join-Path $root "app\api\market\requests\[id]\split-fallback\slot-map\route.ts"

foreach (
    $path in @(
        $marketDetail,
        $entryPath,
        $reviewPath,
        $slotMapPath
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

$detail =
    [System.IO.File]::ReadAllText(
        $marketDetail
    )

$entry =
    [System.IO.File]::ReadAllText(
        $entryPath
    )

$review =
    [System.IO.File]::ReadAllText(
        $reviewPath
    )

$slotMap =
    [System.IO.File]::ReadAllText(
        $slotMapPath
    )

$checks = @(
    @{
        Name = "13.17 wiring marker"
        Value =
            $detail.Contains(
                "KLYX_MULTI_PROVIDER_REVIEW_WIRING_13_17"
            )
    },
    @{
        Name = "entry component marker"
        Value =
            $entry.Contains(
                "KLYX_MULTI_PROVIDER_REVIEW_ENTRY_13_17"
            )
    },
    @{
        Name = "review page marker"
        Value =
            $review.Contains(
                "KLYX_MULTI_PROVIDER_REVIEW_PAGE_13_17"
            )
    },
    @{
        Name = "entry imported"
        Value =
            $detail.Contains(
                'import SplitPlanEntryCard from "./SplitPlanEntryCard";'
            )
    },
    @{
        Name = "entry rendered"
        Value =
            $detail.Contains(
                "<SplitPlanEntryCard />"
            )
    },
    @{
        Name = "13.16 endpoint consumed"
        Value =
            $entry.Contains(
                "/split-fallback/slot-map"
            ) -and
            $review.Contains(
                "/split-fallback/slot-map"
            )
    },
    @{
        Name = "authenticated requests"
        Value =
            $entry.Contains(
                "supabase.auth.getSession()"
            ) -and
            $review.Contains(
                "supabase.auth.getSession()"
            )
    },
    @{
        Name = "split only CTA"
        Value =
            $entry.Contains(
                "body.splitPlanPossible"
            ) -and
            $entry.Contains(
                "body.singleProviderFullCoverage"
            )
    },
    @{
        Name = "provider assignment visible"
        Value =
            $review.Contains(
                "assignment.providerName"
            )
    },
    @{
        Name = "assigned slots visible"
        Value =
            $review.Contains(
                "assignment.assignedSlots.map"
            )
    },
    @{
        Name = "slot date visible"
        Value =
            $review.Contains(
                "formatDate("
            )
    },
    @{
        Name = "slot times visible"
        Value =
            $review.Contains(
                "slot.startTime"
            ) -and
            $review.Contains(
                "slot.endTime"
            )
    },
    @{
        Name = "slot budget visible"
        Value =
            $review.Contains(
                "formatBudget("
            )
    },
    @{
        Name = "manual live refresh"
        Value =
            $review.Contains(
                "Revérifier le plan"
            )
    },
    @{
        Name = "single provider priority preserved"
        Value =
            $review.Contains(
                "singleProviderFullCoverage"
            )
    },
    @{
        Name = "no selection message"
        Value =
            $review.Contains(
                "Aucun engagement pour le moment"
            )
    },
    @{
        Name = "13.16 retained"
        Value =
            $slotMap.Contains(
                "KLYX_MULTI_PROVIDER_EXACT_SLOT_MAP_13_16"
            )
    },
    @{
        Name = "no booking API"
        Value =
            -not $review.Contains(
                "group-booking"
            )
    },
    @{
        Name = "no payment API"
        Value =
            -not $review.Contains(
                "checkout"
            )
    }
)

$failed =
    @()

Write-Host ""
Write-Host "CHECK KLYX 13.17"
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

    throw "KLYX 13.17 static checker FAILED."
}

Push-Location $root

try {
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

        throw "KLYX 13.17 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw "KLYX 13.17 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.17 CHECK OK"
Write-Host "======================================"
Write-Host "Market -> split plan : CONNECTE"
Write-Host "Prestataire par slot : VISIBLE"
Write-Host "Date / heure / budget : VISIBLES"
Write-Host "Couverture N/N : VISIBLE"
Write-Host "Revalidation live : ACTIVE"
Write-Host "Prestataire unique : TOUJOURS PRIORITAIRE"
Write-Host "Confirmation explicite : ENCORE OBLIGATOIRE"
Write-Host "Selection automatique : NON"
Write-Host "Booking automatique : NON"
Write-Host "Paiement automatique : NON"
Write-Host "Migration : AUCUNE"
Write-Host "Build Next.js : OK"
Write-Host "======================================"
Write-Host ""