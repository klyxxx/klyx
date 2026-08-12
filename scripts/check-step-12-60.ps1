$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$targetPath = Join-Path $projectRoot "app\api\brain\respond\route.ts"

Write-Host ""
Write-Host "CHECK KLYX 12.60"
Write-Host ""

if (-not (Test-Path -LiteralPath $targetPath)) {
    throw "route.ts introuvable."
}

$content = [System.IO.File]::ReadAllText($targetPath)

function Count-Literal {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Text,

        [Parameter(Mandatory = $true)]
        [string]$Value
    )

    $count = 0
    $position = 0

    while ($true) {
        $index = $Text.IndexOf(
            $Value,
            $position,
            [System.StringComparison]::Ordinal
        )

        if ($index -lt 0) {
            break
        }

        $count++
        $position = $index + $Value.Length
    }

    return $count
}

$checks = @(
    @{
        Name = "12.59 conserve"
        Value = $content.Contains(
            "KLYX_POST_CONFIRMATION_12_59"
        )
    },
    @{
        Name = "12.60 present"
        Value = $content.Contains(
            "KLYX_VISIBLE_READINESS_12_60"
        )
    },
    @{
        Name = "12.60 unique"
        Value = (
            (Count-Literal `
                -Text $content `
                -Value "KLYX_VISIBLE_READINESS_12_60") -eq 1
        )
    },
    @{
        Name = "guided question active"
        Value = $content.Contains(
            "const guidedQuestion ="
        )
    },
    @{
        Name = "nextCompletionQuestion used"
        Value = $content.Contains(
            "nextCompletionQuestion ??"
        )
    },
    @{
        Name = "progress status used"
        Value = $content.Contains(
            'return `${completionStatusText}\n\n${guidedQuestion}`;'
        )
    },
    @{
        Name = "summary used"
        Value = $content.Contains(
            "completionConfirmationText ??"
        )
    },
    @{
        Name = "confirmation prompt used"
        Value = $content.Contains(
            "completionConfirmationPrompt ??"
        )
    },
    @{
        Name = "old automatic-looking reply removed"
        Value = -not $content.Contains(
            "Je peux maintenant chercher les meilleurs prestataires."
        )
    },
    @{
        Name = "global automatic execution guard"
        Value = $content.Contains(
            "const automaticExecutionAllowed = false;"
        )
    },
    @{
        Name = "market protection preserved"
        Value = $content.Contains(
            '"market_publish",'
        )
    },
    @{
        Name = "booking protection preserved"
        Value = $content.Contains(
            '"booking_create",'
        )
    },
    @{
        Name = "payment protection preserved"
        Value = $content.Contains(
            '"payment_create",'
        )
    }
)

$failedNames = @()

foreach ($check in $checks) {
    if ($check.Value) {
        Write-Host "[OK]   $($check.Name)"
    }
    else {
        Write-Host "[FAIL] $($check.Name)"
        $failedNames += $check.Name
    }
}

if ($failedNames.Count -gt 0) {
    Write-Host ""
    Write-Host "ECHECS DETECTES :"

    foreach ($name in $failedNames) {
        Write-Host " - $name"
    }

    throw "KLYX 12.60 static checker FAILED."
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
Write-Host "KLYX 12.60 CHECK OK"
Write-Host "Brain Visible Readiness operationnel."
Write-Host "12.49-12.59 servent maintenant la conversation."
Write-Host "======================================"
Write-Host ""