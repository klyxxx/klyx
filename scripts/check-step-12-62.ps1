$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "CHECK KLYX 12.62"
Write-Host ""

$candidates = @(
    (Join-Path $projectRoot "app\assistant\page.tsx"),
    (Join-Path $projectRoot "app\brain\page.tsx")
)

$targetPath = $null

foreach ($candidate in $candidates) {
    if (-not (Test-Path -LiteralPath $candidate)) {
        continue
    }

    $candidateContent = [System.IO.File]::ReadAllText($candidate)

    if (
        $candidateContent.Contains(
            "KLYX_ASSISTANT_READINESS_UI_12_62"
        )
    ) {
        $targetPath = $candidate
        break
    }
}

if (-not $targetPath) {
    throw "Page KLYX 12.62 introuvable."
}

$componentPath = Join-Path `
    $projectRoot `
    "app\components\BrainReadinessCard.tsx"

if (-not (Test-Path -LiteralPath $componentPath)) {
    throw "BrainReadinessCard.tsx introuvable."
}

$page = [System.IO.File]::ReadAllText($targetPath)
$component = [System.IO.File]::ReadAllText($componentPath)

$checks = @(
    @{
        Name = "12.62 page marker"
        Value = $page.Contains(
            "KLYX_ASSISTANT_READINESS_UI_12_62"
        )
    },
    @{
        Name = "12.62 component marker"
        Value = $component.Contains(
            "KLYX_READINESS_CARD_12_62"
        )
    },
    @{
        Name = "readiness type connected"
        Value = $page.Contains(
            "readiness?: BrainReadinessViewModel;"
        )
    },
    @{
        Name = "readiness rendered"
        Value = $page.Contains(
            "payload?.readiness"
        )
    },
    @{
        Name = "confirm callback"
        Value = $page.Contains(
            "onConfirm={openResults}"
        )
    },
    @{
        Name = "edit callback"
        Value = $page.Contains(
            "onEdit={editCurrentRequest}"
        )
    },
    @{
        Name = "progress bar"
        Value = $component.Contains(
            'style={{ width: `${safeScore}%` }}'
        )
    },
    @{
        Name = "summary service"
        Value = $component.Contains(
            "{readiness.summary.service}"
        )
    },
    @{
        Name = "summary city"
        Value = $component.Contains(
            "{readiness.summary.city}"
        )
    },
    @{
        Name = "summary date"
        Value = $component.Contains(
            "{readiness.summary.date}"
        )
    },
    @{
        Name = "summary time"
        Value = $component.Contains(
            "{readiness.summary.time}"
        )
    },
    @{
        Name = "explicit confirmation text"
        Value = $component.Contains(
            "KLYX attend ta confirmation avant toute action."
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

    throw "KLYX 12.62 static checker FAILED."
}

Write-Host ""
Write-Host "Interface detectee : $targetPath"
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
Write-Host "Assistant Readiness UI operationnel."
Write-Host "Progression et confirmation visibles."
Write-Host "======================================"
Write-Host ""