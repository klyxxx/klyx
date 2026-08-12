$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$targetPath = Join-Path $projectRoot "app\api\brain\respond\route.ts"

Write-Host ""
Write-Host "CHECK KLYX 12.53"
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
        Name = "12.51 conserve"
        Value = $content.Contains("KLYX_GUIDED_COMPLETION_12_51")
    },
    @{
        Name = "12.52 conserve"
        Value = $content.Contains("KLYX_PROGRESS_FEEDBACK_12_52")
    },
    @{
        Name = "12.53 present"
        Value = $content.Contains("KLYX_REQUEST_SUMMARY_12_53")
    },
    @{
        Name = "summary variable"
        Value = $content.Contains(
            "const completionRequestSummary = isRequestComplete"
        )
    },
    @{
        Name = "service present"
        Value = $content.Contains(
            "service: context.serviceSlug,"
        )
    },
    @{
        Name = "city present"
        Value = $content.Contains(
            "city: context.city,"
        )
    },
    @{
        Name = "date present"
        Value = $content.Contains(
            "date: context.date,"
        )
    },
    @{
        Name = "time present"
        Value = $content.Contains(
            "time: context.time,"
        )
    },
    @{
        Name = "confirmation text"
        Value = $content.Contains(
            "const completionConfirmationText = isRequestComplete"
        )
    },
    @{
        Name = "summary expose"
        Value = $content.Contains(
            "summary: completionRequestSummary,"
        )
    },
    @{
        Name = "confirmation text expose"
        Value = $content.Contains(
            "confirmationText: completionConfirmationText,"
        )
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
    throw "KLYX 12.53 checker FAILED."
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
Write-Host "KLYX 12.53 CHECK OK"
Write-Host "Brain Request Summary operationnel."
Write-Host "======================================"
Write-Host ""