$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$targetPath = Join-Path $projectRoot "app\api\brain\respond\route.ts"

Write-Host ""
Write-Host "CHECK KLYX 12.50"
Write-Host ""

if (-not (Test-Path -LiteralPath $targetPath)) {
    throw "route.ts introuvable."
}

$content = [System.IO.File]::ReadAllText($targetPath)

$checks = @(
    @{
        Name = "12.49 present"
        Value = $content.Contains("KLYX_COMPLETENESS_12_49")
    },
    @{
        Name = "12.50 present"
        Value = $content.Contains("KLYX_READINESS_12_50")
    },
    @{
        Name = "missingCompletionParts"
        Value = $content.Contains("const missingCompletionParts: string[] = [];")
    },
    @{
        Name = "service missing detection"
        Value = $content.Contains('if (!context.serviceSlug) missingCompletionParts.push("service");')
    },
    @{
        Name = "city missing detection"
        Value = $content.Contains('if (!context.city) missingCompletionParts.push("ville");')
    },
    @{
        Name = "date missing detection"
        Value = $content.Contains('if (!context.date) missingCompletionParts.push("date");')
    },
    @{
        Name = "time missing detection"
        Value = $content.Contains('if (!context.time) missingCompletionParts.push("heure");')
    },
    @{
        Name = "complete state"
        Value = $content.Contains("const isRequestComplete = completionScore === 100;")
    },
    @{
        Name = "next missing state"
        Value = $content.Contains("const nextMissingPart = missingCompletionParts[0] ?? null;")
    },
    @{
        Name = "readiness contract"
        Value = $content.Contains("const requestReadiness = {")
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
    throw "KLYX 12.50 checker FAILED."
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
Write-Host "KLYX 12.50 CHECK OK"
Write-Host "Brain Readiness operationnel."
Write-Host "======================================"
Write-Host ""