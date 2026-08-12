$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$targetPath = Join-Path $projectRoot "app\api\brain\respond\route.ts"

Write-Host ""
Write-Host "CHECK KLYX 12.58"
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
        Name = "12.56 conserve"
        Value = $content.Contains(
            "KLYX_CONFIRMATION_CHOICES_12_56"
        )
    },
    @{
        Name = "12.57 conserve"
        Value = $content.Contains(
            "KLYX_CONFIRMATION_POLICY_12_57"
        )
    },
    @{
        Name = "12.58 present"
        Value = $content.Contains(
            "KLYX_ACTION_ELIGIBILITY_12_58"
        )
    },
    @{
        Name = "12.58 unique"
        Value = (
            (Count-Literal `
                -Text $content `
                -Value "KLYX_ACTION_ELIGIBILITY_12_58") -eq 1
        )
    },
    @{
        Name = "eligibility object"
        Value = $compact.Contains(
            "constcompletionActionEligibility={"
        )
    },
    @{
        Name = "edit request allowed"
        Value = $compact.Contains(
            "editRequest:true,"
        )
    },
    @{
        Name = "market publish blocked"
        Value = $compact.Contains(
            "marketPublish:false,"
        )
    },
    @{
        Name = "booking blocked"
        Value = $compact.Contains(
            "bookingCreate:false,"
        )
    },
    @{
        Name = "payment blocked"
        Value = $compact.Contains(
            "paymentCreate:false,"
        )
    },
    @{
        Name = "blocked reason"
        Value = $compact.Contains(
            "blockedReason:isRequestComplete"
        )
    },
    @{
        Name = "awaiting confirmation reason"
        Value = $compact.Contains(
            '?"awaiting_user_confirmation"'
        )
    },
    @{
        Name = "incomplete reason"
        Value = $compact.Contains(
            ':"request_incomplete",'
        )
    },
    @{
        Name = "eligibility exposed"
        Value = $compact.Contains(
            "actionEligibility:completionActionEligibility,"
        )
    },
    @{
        Name = "confirmation policy preserved"
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

    throw "KLYX 12.58 static checker FAILED."
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
Write-Host "KLYX 12.58 CHECK OK"
Write-Host "Brain Action Eligibility operationnel."
Write-Host "Transactions toujours bloquees avant confirmation."
Write-Host "======================================"
Write-Host ""