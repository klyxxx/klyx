$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

$componentPath = Join-Path `
    $projectRoot `
    "app\components\BrainReadinessCard.tsx"

Write-Host ""
Write-Host "CHECK KLYX 12.62c"
Write-Host ""

if (-not (Test-Path -LiteralPath $componentPath)) {
    throw "BrainReadinessCard.tsx introuvable."
}

$content = [System.IO.File]::ReadAllText(
    $componentPath
)

$checks = @(
    @{
        Name = "repair marker"
        Value = $content.Contains(
            "KLYX_READINESS_CARD_REPAIR_12_62C"
        )
    },
    @{
        Name = "safe progress syntax"
        Value = $content.Contains(
            'style={{ width: String(safeScore) + "%" }}'
        )
    },
    @{
        Name = "old risky syntax removed"
        Value = -not $content.Contains(
            '`${safeScore}%`'
        )
    },
    @{
        Name = "service summary"
        Value = $content.Contains(
            "readiness.summary.service"
        )
    },
    @{
        Name = "city summary"
        Value = $content.Contains(
            "readiness.summary.city"
        )
    },
    @{
        Name = "date summary"
        Value = $content.Contains(
            "readiness.summary.date"
        )
    },
    @{
        Name = "time summary"
        Value = $content.Contains(
            "readiness.summary.time"
        )
    },
    @{
        Name = "confirm callback"
        Value = $content.Contains(
            "onClick={onConfirm}"
        )
    },
    @{
        Name = "edit callback"
        Value = $content.Contains(
            "onClick={onEdit}"
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

    throw "KLYX 12.62c static checker FAILED."
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
Write-Host "KLYX 12.62 CHECK OK"
Write-Host "BrainReadinessCard compile correctement."
Write-Host "Assistant Readiness UI operationnel."
Write-Host "======================================"
Write-Host ""