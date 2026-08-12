$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$targetPath = Join-Path $projectRoot "app\api\brain\respond\route.ts"

Write-Host ""
Write-Host "CHECK KLYX 12.57"
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
        Name = "12.54 conserve"
        Value = $content.Contains(
            "KLYX_CONFIRMATION_GATE_12_54"
        )
    },
    @{
        Name = "12.55 conserve"
        Value = $content.Contains(
            "KLYX_CONFIRMATION_PROMPT_12_55"
        )
    },
    @{
        Name = "12.56 conserve"
        Value = $content.Contains(
            "KLYX_CONFIRMATION_CHOICES_12_56"
        )
    },
    @{
        Name = "12.57 present"
        Value = $content.Contains(
            "KLYX_CONFIRMATION_POLICY_12_57"
        )
    },
    @{
        Name = "12.57 unique"
        Value = (
            (Count-Literal `
                -Text $content `
                -Value "KLYX_CONFIRMATION_POLICY_12_57") -eq 1
        )
    },
    @{
        Name = "protected actions"
        Value = $compact.Contains(
            "constconfirmationProtectedActions=["
        )
    },
    @{
        Name = "market publish protected"
        Value = $compact.Contains(
            '"market_publish",'
        )
    },
    @{
        Name = "booking protected"
        Value = $compact.Contains(
            '"booking_create",'
        )
    },
    @{
        Name = "payment protected"
        Value = $compact.Contains(
            '"payment_create",'
        )
    },
    @{
        Name = "safe actions"
        Value = $compact.Contains(
            "constconfirmationSafeActions=["
        )
    },
    @{
        Name = "edit request safe"
        Value = $compact.Contains(
            '"edit_request",'
        )
    },
    @{
        Name = "confirmation policy object"
        Value = $compact.Contains(
            "constcompletionConfirmationPolicy={"
        )
    },
    @{
        Name = "confirmation required"
        Value = $compact.Contains(
            "required:requiresUserConfirmation,"
        )
    },
    @{
        Name = "protected actions exposed"
        Value = $compact.Contains(
            "protectedActions:confirmationProtectedActions,"
        )
    },
    @{
        Name = "safe actions exposed"
        Value = $compact.Contains(
            "safeActions:confirmationSafeActions,"
        )
    },
    @{
        Name = "policy exposed"
        Value = $compact.Contains(
            "confirmationPolicy:completionConfirmationPolicy,"
        )
    },
    @{
        Name = "automatic execution disabled"
        Value = $compact.Contains(
            "constautomaticExecutionAllowed=false;"
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

    throw "KLYX 12.57 static checker FAILED."
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
Write-Host "KLYX 12.57 CHECK OK"
Write-Host "Brain Confirmation Policy operationnel."
Write-Host "Actions sensibles protegees."
Write-Host "======================================"
Write-Host ""