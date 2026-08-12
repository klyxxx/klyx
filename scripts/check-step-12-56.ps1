$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$targetPath = Join-Path $projectRoot "app\api\brain\respond\route.ts"

Write-Host ""
Write-Host "CHECK KLYX 12.56"
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
        Name = "12.56 present"
        Value = $content.Contains(
            "KLYX_CONFIRMATION_CHOICES_12_56"
        )
    },
    @{
        Name = "12.56 unique"
        Value = (
            (Count-Literal `
                -Text $content `
                -Value "KLYX_CONFIRMATION_CHOICES_12_56") -eq 1
        )
    },
    @{
        Name = "confirmation state"
        Value = $compact.Contains(
            "constcompletionConfirmationState=isRequestComplete"
        )
    },
    @{
        Name = "awaiting confirmation state"
        Value = $compact.Contains(
            '?"awaiting_user_confirmation"'
        )
    },
    @{
        Name = "not ready state"
        Value = $compact.Contains(
            ':"not_ready";'
        )
    },
    @{
        Name = "confirmation options"
        Value = $compact.Contains(
            "constcompletionConfirmationOptions=isRequestComplete"
        )
    },
    @{
        Name = "confirm action"
        Value = $compact.Contains(
            'action:"confirm_request",'
        )
    },
    @{
        Name = "edit action"
        Value = $compact.Contains(
            'action:"edit_request",'
        )
    },
    @{
        Name = "confirmation state exposed"
        Value = $compact.Contains(
            "confirmationState:completionConfirmationState,"
        )
    },
    @{
        Name = "confirmation options exposed"
        Value = $compact.Contains(
            "confirmationOptions:completionConfirmationOptions,"
        )
    },
    @{
        Name = "automatic execution disabled"
        Value = $compact.Contains(
            "constautomaticExecutionAllowed=false;"
        )
    },
    @{
        Name = "confirmation prompt preserved"
        Value = $compact.Contains(
            "confirmationPrompt:completionConfirmationPrompt,"
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

    throw "KLYX 12.56 static checker FAILED."
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
Write-Host "KLYX 12.56 CHECK OK"
Write-Host "Brain Confirmation Choices operationnel."
Write-Host "======================================"
Write-Host ""