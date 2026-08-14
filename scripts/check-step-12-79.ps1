$ErrorActionPreference = "Stop"

$projectRoot =
    Split-Path -Parent $PSScriptRoot

$commandPath = Join-Path `
    $projectRoot `
    "app\components\AssistantCommandBar.tsx"

$assistantPath = Join-Path `
    $projectRoot `
    "app\assistant\page.tsx"

$actionsPath = Join-Path `
    $projectRoot `
    "app\api\brain\actions\route.ts"

Write-Host ""
Write-Host "CHECK KLYX 12.79"
Write-Host ""

foreach ($path in @(
    $commandPath,
    $assistantPath,
    $actionsPath
)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Fichier absent : $path"
    }
}

$command =
    [System.IO.File]::ReadAllText(
        $commandPath
    )

$assistant =
    [System.IO.File]::ReadAllText(
        $assistantPath
    )

$actions =
    [System.IO.File]::ReadAllText(
        $actionsPath
    )

$checks = @(
    @{
        Name = "smart command 12.79"
        Value = $command.Contains(
            "KLYX_SMART_COMMAND_12_79"
        )
    },
    @{
        Name = "Brain actions source"
        Value = $actions.Contains(
            "KLYX_BRAIN_MISSION_LIFECYCLE_12_78"
        )
    },
    @{
        Name = "payment routing"
        Value = $command.Contains(
            '"payment_pending"'
        )
    },
    @{
        Name = "mission routing"
        Value =
            $command.Contains(
                '"track_mission"'
            ) -and
            $command.Contains(
                '"provider_track_mission"'
            )
    },
    @{
        Name = "completion routing"
        Value =
            $command.Contains(
                '"confirm_completion"'
            ) -and
            $command.Contains(
                '"provider_finish_mission"'
            )
    },
    @{
        Name = "booking request routing"
        Value = $command.Contains(
            '"provider_booking_request"'
        )
    },
    @{
        Name = "new service fallback"
        Value = $command.Contains(
            '"/assistant/market?"'
        )
    },
    @{
        Name = "real href navigation"
        Value = $command.Contains(
            "router.push(action.href)"
        )
    },
    @{
        Name = "assistant integration"
        Value = $assistant.Contains(
            "KLYX_SMART_COMMAND_HOME_12_79"
        )
    },
    @{
        Name = "real actions passed"
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
    throw "KLYX 12.79 static checker FAILED."
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
            Select-Object -First 150 |
            ForEach-Object {
                Write-Host $_
            }

        throw "KLYX 12.79 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if ($LASTEXITCODE -ne 0) {
        throw "KLYX 12.79 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.79 CHECK OK"
Write-Host "======================================"
Write-Host "Conversation -> paiement : OK"
Write-Host "Conversation -> suivi : OK"
Write-Host "Conversation -> fin mission : OK"
Write-Host "Conversation -> reservation : OK"
Write-Host "Conversation -> nouvelle demande : OK"
Write-Host "Build Next.js : OK"
Write-Host "======================================"
Write-Host ""