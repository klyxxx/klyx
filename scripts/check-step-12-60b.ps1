$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$targetPath = Join-Path $projectRoot "app\api\brain\respond\route.ts"

Write-Host ""
Write-Host "CHECK KLYX 12.60b"
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
        Name = "Brain guided question connected"
        Value = $content.Contains(
            "nextCompletionQuestion ??"
        )
    },
    @{
        Name = "original question fallback preserved"
        Value = $content.Contains(
            "questions[missing[0]] ??"
        )
    },
    @{
        Name = "progress visible"
        Value = $content.Contains(
            'return `${completionStatusText}\n\n${guidedQuestion}`;'
        )
    },
    @{
        Name = "summary visible"
        Value = $content.Contains(
            'completionConfirmationText ?? "Demande prête."'
        )
    },
    @{
        Name = "confirmation prompt visible"
        Value = $content.Contains(
            "completionConfirmationPrompt ??"
        )
    },
    @{
        Name = "automatic execution disabled"
        Value = $content.Contains(
            "const automaticExecutionAllowed = false;"
        )
    },
    @{
        Name = "market publish protection"
        Value = $content.Contains(
            '"market_publish",'
        )
    },
    @{
        Name = "booking protection"
        Value = $content.Contains(
            '"booking_create",'
        )
    },
    @{
        Name = "payment protection"
        Value = $content.Contains(
            '"payment_create",'
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

    throw "KLYX 12.60b static checker FAILED."
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
Write-Host "======================================"
Write-Host ""