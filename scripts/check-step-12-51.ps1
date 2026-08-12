$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$targetPath = Join-Path $projectRoot "app\api\brain\respond\route.ts"

Write-Host ""
Write-Host "CHECK KLYX 12.51"
Write-Host ""

if (-not (Test-Path -LiteralPath $targetPath)) {
    throw "route.ts introuvable."
}

$content = [System.IO.File]::ReadAllText($targetPath)

$checks = @(
    @{
        Name = "12.49 conserve"
        Value = $content.Contains("KLYX_COMPLETENESS_12_49")
    },
    @{
        Name = "12.50 conserve"
        Value = $content.Contains("KLYX_READINESS_12_50")
    },
    @{
        Name = "12.51 present"
        Value = $content.Contains("KLYX_GUIDED_COMPLETION_12_51")
    },
    @{
        Name = "nextCompletionQuestion"
        Value = $content.Contains("const nextCompletionQuestion =")
    },
    @{
        Name = "service question"
        Value = $content.Contains('nextMissingPart === "service"')
    },
    @{
        Name = "ville question"
        Value = $content.Contains('nextMissingPart === "ville"')
    },
    @{
        Name = "date question"
        Value = $content.Contains('nextMissingPart === "date"')
    },
    @{
        Name = "heure question"
        Value = $content.Contains('nextMissingPart === "heure"')
    },
    @{
        Name = "complete gives null question"
        Value = $content.Contains(': null;')
    },
    @{
        Name = "question exposed in readiness"
        Value = $content.Contains("question: nextCompletionQuestion,")
    }
)

$failed = $false

foreach ($check in $checks) {
    if ($check.Value) {
        Write-Host "[OK] $($check.Name)"
    }
    else {
        Write-Host "[FAIL] $($check.Name)"
        $failed = $true
    }
}

if ($failed) {
    throw "KLYX 12.51 checker FAILED."
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
Write-Host "KLYX 12.51 CHECK OK"
Write-Host "Brain Guided Completion operationnel."
Write-Host "======================================"
Write-Host ""