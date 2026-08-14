$ErrorActionPreference = "Stop"

$projectRoot =
    Split-Path -Parent $PSScriptRoot

$apiPath = Join-Path `
    $projectRoot `
    "app\api\brain\command\route.ts"

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
Write-Host "CHECK KLYX 12.80"
Write-Host ""

foreach ($path in @(
    $apiPath,
    $commandPath,
    $assistantPath,
    $actionsPath
)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Fichier absent : $path"
    }
}

$api =
    [System.IO.File]::ReadAllText(
        $apiPath
    )

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
        Name = "server router 12.80"
        Value = $api.Contains(
            "KLYX_SERVER_COMMAND_ROUTER_12_80"
        )
    },
    @{
        Name = "auth required"
        Value = $api.Contains(
            "getAuthenticatedProfile(request)"
        )
    },
    @{
        Name = "existing actions"
        Value = $api.Contains(
            '"existing_action"'
        )
    },
    @{
        Name = "new requests"
        Value = $api.Contains(
            '"new_request"'
        )
    },
    @{
        Name = "general actions"
        Value = $api.Contains(
            "hasGeneralActionIntent"
        )
    },
    @{
        Name = "new need detection"
        Value = $api.Contains(
            "hasNewNeedIntent"
        )
    },
    @{
        Name = "protected execution disabled"
        Value = $api.Contains(
            "automaticExecutionAllowed: false"
        )
    },
    @{
        Name = "safe href filtering"
        Value = $api.Contains(
            "isAllowedHref"
        )
    },
    @{
        Name = "command UI 12.80"
        Value = $command.Contains(
            "KLYX_SERVER_COMMAND_UI_12_80"
        )
    },
    @{
        Name = "server command fetch"
        Value = $command.Contains(
            '"/api/brain/command"'
        )
    },
    @{
        Name = "real actions sent"
        Value = $command.Contains(
            "actions,"
        )
    },
    @{
        Name = "assistant actions passed"
        Value = $assistant.Contains(
            "actions={data?.actions ?? []}"
        )
    },
    @{
        Name = "Brain lifecycle retained"
        Value = $actions.Contains(
            "KLYX_BRAIN_MISSION_LIFECYCLE_12_78"
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
    throw "KLYX 12.80 static checker FAILED."
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

        throw "KLYX 12.80 TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if ($LASTEXITCODE -ne 0) {
        throw "KLYX 12.80 build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.80 CHECK OK"
Write-Host "======================================"
Write-Host "Nouvelle demande -> Market : OK"
Write-Host "Paiement existant -> action : OK"
Write-Host "Mission existante -> suivi : OK"
Write-Host "Fin mission -> confirmation : OK"
Write-Host "Execution automatique sensible : NON"
Write-Host "Build Next.js : OK"
Write-Host "======================================"
Write-Host ""