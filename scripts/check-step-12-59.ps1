$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$targetPath = Join-Path $projectRoot "app\api\brain\respond\route.ts"

Write-Host ""
Write-Host "CHECK KLYX 12.59"
Write-Host ""

if (-not (Test-Path -LiteralPath $targetPath)) {
    throw "route.ts introuvable."
}

$content = [System.IO.File]::ReadAllText($targetPath)

function Remove-CodeWhitespace {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Text
    )

    $builder = New-Object System.Text.StringBuilder

    foreach ($char in $Text.ToCharArray()) {
        if (-not [char]::IsWhiteSpace($char)) {
            [void]$builder.Append($char)
        }
    }

    return $builder.ToString()
}

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

$compact = Remove-CodeWhitespace $content

$checks = @(
    @{
        Name = "12.57 conserve"
        Value = $content.Contains(
            "KLYX_CONFIRMATION_POLICY_12_57"
        )
    },
    @{
        Name = "12.58 conserve"
        Value = $content.Contains(
            "KLYX_ACTION_ELIGIBILITY_12_58"
        )
    },
    @{
        Name = "12.59 present"
        Value = $content.Contains(
            "KLYX_POST_CONFIRMATION_12_59"
        )
    },
    @{
        Name = "12.59 unique"
        Value = (
            (Count-Literal `
                -Text $content `
                -Value "KLYX_POST_CONFIRMATION_12_59") -eq 1
        )
    },
    @{
        Name = "post confirmation object"
        Value = $compact.Contains(
            "constcompletionPostConfirmation=isRequestComplete"
        )
    },
    @{
        Name = "ready for market state"
        Value = $compact.Contains(
            'nextState:"ready_for_market_publish",'
        )
    },
    @{
        Name = "market publish unlock"
        Value = $compact.Contains(
            'unlocks:["market_publish"],'
        )
    },
    @{
        Name = "booking remains protected"
        Value = $compact.Contains(
            '"booking_create",'
        )
    },
    @{
        Name = "payment remains protected"
        Value = $compact.Contains(
            '"payment_create",'
        )
    },
    @{
        Name = "explicit confirmation required"
        Value = $compact.Contains(
            "requiresExplicitConfirmation:true,"
        )
    },
    @{
        Name = "post confirmation execution disabled"
        Value = $compact.Contains(
            "automaticExecutionAllowed:false,"
        )
    },
    @{
        Name = "post confirmation exposed"
        Value = $compact.Contains(
            "postConfirmation:completionPostConfirmation,"
        )
    },
    @{
        Name = "global execution guard preserved"
        Value = $compact.Contains(
            "constautomaticExecutionAllowed=false;"
        )
    },
    @{
        Name = "eligibility preserved"
        Value = $compact.Contains(
            "actionEligibility:completionActionEligibility,"
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

    throw "KLYX 12.59 static checker FAILED."
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
Write-Host "KLYX 12.59 CHECK OK"
Write-Host "Post-Confirmation Transition operationnel."
Write-Host "Market publish pret apres confirmation."
Write-Host "Booking et paiement restent proteges."
Write-Host "======================================"
Write-Host ""