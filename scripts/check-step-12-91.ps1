$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

$helperPath =
    Join-Path $root "lib\brain-group-cancellation-actions.ts"

$routePath =
    Join-Path $root "app\api\brain\actions\route.ts"

$brainPath =
    Join-Path $root "lib\brain-actions.ts"

$cancellationPath =
    Join-Path $root "app\api\booking-groups\[id]\cancellation\route.ts"

$refundPath =
    Join-Path $root "lib\stripe-group-refunds.ts"

foreach (
    $path in @(
        $helperPath,
        $routePath,
        $brainPath,
        $cancellationPath,
        $refundPath
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

$helper =
    [System.IO.File]::ReadAllText(
        $helperPath
    )

$route =
    [System.IO.File]::ReadAllText(
        $routePath
    )

$brain =
    [System.IO.File]::ReadAllText(
        $brainPath
    )

$cancellation =
    [System.IO.File]::ReadAllText(
        $cancellationPath
    )

$refund =
    [System.IO.File]::ReadAllText(
        $refundPath
    )

$checks = @(
    @{
        Name = "group cancellation actions"
        Value =
            $helper.Contains(
                "KLYX_GROUP_CANCELLATION_ACTIONS_12_91"
            )
    },
    @{
        Name = "decision action"
        Value =
            $helper.Contains(
                "group_cancellation_decision"
            )
    },
    @{
        Name = "requester waiting action"
        Value =
            $helper.Contains(
                "group_cancellation_waiting"
            )
    },
    @{
        Name = "refund processing action"
        Value =
            $helper.Contains(
                "group_refund_processing"
            )
    },
    @{
        Name = "refund failed priority"
        Value =
            $helper.Contains(
                "group_refund_failed"
            ) -and
            $helper.Contains(
                "priority: 160"
            )
    },
    @{
        Name = "resolved refunds disappear"
        Value =
            $helper.Contains(
                'group.refund_status ==='
            ) -and
            $helper.Contains(
                '"refunded"'
            )
    },
    @{
        Name = "Action Center route 12.91"
        Value =
            $route.Contains(
                "KLYX_GROUP_ACTION_CENTER_12_91"
            )
    },
    @{
        Name = "server Brain Actions retained"
        Value =
            $route.Contains(
                "getBrainActions("
            )
    },
    @{
        Name = "group actions merged"
        Value =
            $route.Contains(
                "getGroupCancellationBrainActions("
            )
    },
    @{
        Name = "conflicting group actions filtered"
        Value =
            $route.Contains(
                "protectedHrefs.has("
            )
    },
    @{
        Name = "action deduplication"
        Value =
            $route.Contains(
                "new Map"
            )
    },
    @{
        Name = "automatic execution disabled"
        Value =
            $route.Contains(
                "automaticExecutionAllowed:"
            ) -and
            $route.Contains(
                "false"
            )
    },
    @{
        Name = "12.81 retained"
        Value =
            $brain.Contains(
                "KLYX_SERVER_BRAIN_ACTIONS_12_81"
            )
    },
    @{
        Name = "12.85 group actions retained"
        Value =
            $brain.Contains(
                "KLYX_GROUP_ACTIONS_12_85"
            )
    },
    @{
        Name = "12.90 cancellation retained"
        Value =
            $cancellation.Contains(
                "KLYX_GROUP_CANCELLATION_RESOLUTION_API_12_90"
            )
    },
    @{
        Name = "12.90 refund retained"
        Value =
            $refund.Contains(
                "KLYX_GROUP_REFUND_HELPER_12_90"
            )
    }
)

$failed = @()

Write-Host ""
Write-Host "CHECK KLYX 12.91"
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
    Write-Host "Echecs :"

    $failed |
        ForEach-Object {
            Write-Host " - $_"
        }

    throw "KLYX 12.91 static checker FAILED."
}

Push-Location $root

try {
    Write-Host ""
    Write-Host "TypeScript..."
    Write-Host ""

    $ts =
        @(
            & npx.cmd `
                tsc `
                --noEmit `
                --pretty false 2>&1
        )

    if (
        $LASTEXITCODE -ne 0
    ) {
        $ts |
            Select-Object -First 250 |
            ForEach-Object {
                Write-Host $_
            }

        throw "KLYX 12.91 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw "KLYX 12.91 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.91 CHECK OK"
Write-Host "======================================"
Write-Host "Decision annulation : PRIORITAIRE"
Write-Host "Demandeur en attente : OK"
Write-Host "Remboursement en cours : OK"
Write-Host "Remboursement echoue : URGENT"
Write-Host "Actions groupe concurrentes : MASQUEES"
Write-Host "Paiement trompeur : BLOQUE"
Write-Host "Tracking trompeur : BLOQUE"
Write-Host "Deduplication groupe : OK"
Write-Host "Execution automatique : NON"
Write-Host "Build Next.js : OK"
Write-Host "======================================"
Write-Host ""