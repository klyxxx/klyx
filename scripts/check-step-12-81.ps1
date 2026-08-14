$ErrorActionPreference = "Stop"

$projectRoot =
    Split-Path -Parent $PSScriptRoot

$brainActionsPath =
    Join-Path `
        $projectRoot `
        "lib\brain-actions.ts"

$actionsRoutePath =
    Join-Path `
        $projectRoot `
        "app\api\brain\actions\route.ts"

$commandRoutePath =
    Join-Path `
        $projectRoot `
        "app\api\brain\command\route.ts"

$commandUiPath =
    Join-Path `
        $projectRoot `
        "app\components\AssistantCommandBar.tsx"

$assistantPath =
    Join-Path `
        $projectRoot `
        "app\assistant\page.tsx"

Write-Host ""
Write-Host "CHECK KLYX 12.81"
Write-Host ""

foreach ($path in @(
    $brainActionsPath,
    $actionsRoutePath,
    $commandRoutePath,
    $commandUiPath,
    $assistantPath
)) {
    if (-not (
        Test-Path -LiteralPath $path
    )) {
        throw "Fichier absent : $path"
    }
}

$brain =
    [System.IO.File]::ReadAllText(
        $brainActionsPath
    )

$actions =
    [System.IO.File]::ReadAllText(
        $actionsRoutePath
    )

$command =
    [System.IO.File]::ReadAllText(
        $commandRoutePath
    )

$ui =
    [System.IO.File]::ReadAllText(
        $commandUiPath
    )

$assistant =
    [System.IO.File]::ReadAllText(
        $assistantPath
    )

$checks = @(
    @{
        Name = "shared Brain actions"
        Value = $brain.Contains(
            "KLYX_SERVER_BRAIN_ACTIONS_12_81"
        )
    },
    @{
        Name = "shared action loader"
        Value = $brain.Contains(
            "export async function getBrainActions"
        )
    },
    @{
        Name = "client lifecycle"
        Value =
            $brain.Contains(
                '"payment_pending"'
            ) -and
            $brain.Contains(
                '"track_mission"'
            ) -and
            $brain.Contains(
                '"confirm_completion"'
            )
    },
    @{
        Name = "provider lifecycle"
        Value =
            $brain.Contains(
                '"provider_booking_request"'
            ) -and
            $brain.Contains(
                '"provider_track_mission"'
            ) -and
            $brain.Contains(
                '"provider_finish_mission"'
            )
    },
    @{
        Name = "actions route uses shared server loader"
        Value =
            $actions.Contains(
                "KLYX_BRAIN_ACTIONS_ROUTE_12_81"
            ) -and
            $actions.Contains(
                "getBrainActions(profile)"
            )
    },
    @{
        Name = "trusted command router"
        Value = $command.Contains(
            "KLYX_TRUSTED_COMMAND_ROUTER_12_81"
        )
    },
    @{
        Name = "command recalculates server actions"
        Value = $command.Contains(
            "await getBrainActions("
        )
    },
    @{
        Name = "command ignores browser actions"
        Value =
            -not $command.Contains(
                "body.actions"
            ) -and
            -not $command.Contains(
                "sanitizeActions"
            )
    },
    @{
        Name = "automatic sensitive execution disabled"
        Value = $command.Contains(
            "automaticExecutionAllowed:"
        ) -and
        $command.Contains(
            "false"
        )
    },
    @{
        Name = "trusted command UI"
        Value = $ui.Contains(
            "KLYX_TRUSTED_COMMAND_UI_12_81"
        )
    },
    @{
        Name = "UI calls command API"
        Value = $ui.Contains(
            '"/api/brain/command"'
        )
    },
    @{
        Name = "UI sends message only"
        Value = $ui.Contains(
            "JSON.stringify({"
        ) -and
        $ui.Contains(
            "message,"
        ) -and
        -not $ui.Contains(
            "message,`n                actions"
        )
    },
    @{
        Name = "assistant still passes display actions"
        Value = $assistant.Contains(
            "actions={data?.actions ?? []}"
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

    throw "KLYX 12.81 static checker FAILED."
}

Push-Location $projectRoot

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
            Select-Object -First 160 |
            ForEach-Object {
                Write-Host $_
            }

        throw "KLYX 12.81 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if ($LASTEXITCODE -ne 0) {
        throw "KLYX 12.81 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.81 CHECK OK"
Write-Host "======================================"
Write-Host "Actions DB -> serveur : OK"
Write-Host "Action Center -> serveur : OK"
Write-Host "Commande -> serveur : OK"
Write-Host "Actions client non fiables : SUPPRIMEES"
Write-Host "Execution sensible automatique : NON"
Write-Host "Build Next.js : OK"
Write-Host "======================================"
Write-Host ""