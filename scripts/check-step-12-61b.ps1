$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$targetPath = Join-Path $projectRoot "app\api\brain\respond\route.ts"

Write-Host ""
Write-Host "CHECK KLYX 12.61b"
Write-Host ""

if (-not (Test-Path -LiteralPath $targetPath)) {
    throw "route.ts introuvable."
}

$content = [System.IO.File]::ReadAllText($targetPath)

$checks = @(
    @{
        Name = "12.60 conserve"
        Value = $content.Contains(
            "KLYX_VISIBLE_READINESS_12_60"
        )
    },
    @{
        Name = "12.61 present"
        Value = $content.Contains(
            "KLYX_RESPONSE_METADATA_12_61"
        )
    },
    @{
        Name = "BrainReadinessPayload"
        Value = $content.Contains(
            "type BrainReadinessPayload = {"
        )
    },
    @{
        Name = "BrainPayload readiness"
        Value = $content.Contains(
            "readiness: BrainReadinessPayload;"
        )
    },
    @{
        Name = "readiness builder"
        Value = $content.Contains(
            "function buildReadinessPayload("
        )
    },
    @{
        Name = "score"
        Value = $content.Contains(
            "((4 - remainingCount) / 4) * 100"
        )
    },
    @{
        Name = "next missing"
        Value = $content.Contains(
            "const nextMissing = missing[0] ?? null;"
        )
    },
    @{
        Name = "confirm option"
        Value = $content.Contains(
            'action: "confirm_request",'
        )
    },
    @{
        Name = "edit option"
        Value = $content.Contains(
            'action: "edit_request",'
        )
    },
    @{
        Name = "awaiting confirmation"
        Value = $content.Contains(
            '"awaiting_user_confirmation"'
        )
    },
    @{
        Name = "readiness calculated"
        Value = $content.Contains(
            "const readiness = buildReadinessPayload("
        )
    },
    @{
        Name = "execution disabled"
        Value = $content.Contains(
            "automaticExecutionAllowed: false,"
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
    Write-Host "ECHECS :"

    foreach ($name in $failed) {
        Write-Host " - $name"
    }

    throw "KLYX 12.61b static checker FAILED."
}

Write-Host ""
Write-Host "Tests statiques OK."
Write-Host ""
Write-Host "Lancement npm run build..."
Write-Host ""

Push-Location $projectRoot

try {
    npm run build

    if ($LASTEXITCODE -ne 0) {
        throw "npm run build a echoue avec le code $LASTEXITCODE."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.61 CHECK OK"
Write-Host "Brain Response Metadata operationnel."
Write-Host "readiness disponible dans payload."
Write-Host "======================================"
Write-Host ""