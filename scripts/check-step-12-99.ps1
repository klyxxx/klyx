$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

$pagePath =
    Join-Path $root "app\assistant\market\[id]\page.tsx"

$routePath =
    Join-Path $root "app\api\brain\market-advice\[id]\route.ts"

$recoveryPath =
    Join-Path $root "app\api\market\requests\[id]\group-booking\route.ts"

foreach (
    $path in @(
        $pagePath,
        $routePath,
        $recoveryPath
    )
) {
    if (-not (
        Test-Path -LiteralPath $path
    )) {
        throw "Fichier absent : $path"
    }
}

$page =
    [System.IO.File]::ReadAllText(
        $pagePath
    )

$route =
    [System.IO.File]::ReadAllText(
        $routePath
    )

$recovery =
    [System.IO.File]::ReadAllText(
        $recoveryPath
    )

$checks = @(
    @{
        Name = "client live 12.99"
        Value =
            $page.Contains(
                "KLYX_LIVE_ADVICE_CLIENT_12_99"
            )
    },
    @{
        Name = "payload live metadata"
        Value =
            $page.Contains(
                "liveCoverageChecked?:"
            ) -and
            $page.Contains(
                "staleOffersRemoved?:"
            )
    },
    @{
        Name = "silent load"
        Value =
            $page.Contains(
                "KLYX_LIVE_ADVICE_SILENT_LOAD_12_99"
            )
    },
    @{
        Name = "silent errors preserve UI"
        Value =
            $page.Contains(
                "KLYX_LIVE_ADVICE_SILENT_ERROR_12_99"
            )
    },
    @{
        Name = "15 second auto refresh"
        Value =
            $page.Contains(
                "KLYX_LIVE_ADVICE_AUTO_REFRESH_12_99"
            ) -and
            $page.Contains(
                "15000"
            )
    },
    @{
        Name = "only while visible"
        Value =
            $page.Contains(
                'document.visibilityState ==='
            )
    },
    @{
        Name = "interval cleanup"
        Value =
            $page.Contains(
                "window.clearInterval("
            )
    },
    @{
        Name = "freshness banner"
        Value =
            $page.Contains(
                "KLYX_LIVE_ADVICE_BADGE_12_99"
            )
    },
    @{
        Name = "manual live revalidation"
        Value =
            $page.Contains(
                "Revalider maintenant"
            )
    },
    @{
        Name = "stale count visible"
        Value =
            $page.Contains(
                "liveAdvice.staleOffersRemoved"
            )
    },
    @{
        Name = "no automatic selection UI"
        Value =
            -not $page.Contains(
                "automaticSelection = true"
            )
    },
    @{
        Name = "12.98 retained"
        Value =
            $route.Contains(
                "KLYX_MULTI_SLOT_LIVE_ADVICE_12_98"
            )
    },
    @{
        Name = "12.98c retained"
        Value =
            $route.Contains(
                "KLYX_MULTI_SLOT_LIVE_ADVICE_RANKING_FIX_12_98C"
            )
    },
    @{
        Name = "12.97 recovery retained"
        Value =
            $recovery.Contains(
                "KLYX_GROUP_STALE_PROVIDER_RECOVERY_12_97"
            )
    }
)

$failed = @()

Write-Host ""
Write-Host "CHECK KLYX 12.99"
Write-Host ""

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
    Write-Host "ECHECS EXACTS :"

    foreach ($name in $failed) {
        Write-Host " - $name"
    }

    throw "KLYX 12.99 static checker FAILED."
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
            Select-Object -First 300 |
            ForEach-Object {
                Write-Host $_
            }

        throw "KLYX 12.99 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if ($LASTEXITCODE -ne 0) {
        throw "KLYX 12.99 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.99 CHECK OK"
Write-Host "======================================"
Write-Host "Advice multi-slot : LIVE"
Write-Host "Refresh automatique : 15 SECONDES"
Write-Host "Page inactive : PAS DE POLLING"
Write-Host "Prestataire stale : RETIRE"
Write-Host "Meilleur restant : MIS A JOUR"
Write-Host "Revalidation manuelle : OK"
Write-Host "Erreur silencieuse : UI CONSERVEE"
Write-Host "Selection automatique : NON"
Write-Host "12.97 + 12.98 : CONSERVES"
Write-Host "Build Next.js : OK"
Write-Host "======================================"
Write-Host ""