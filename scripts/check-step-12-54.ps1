$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$targetPath = Join-Path $projectRoot "app\api\brain\respond\route.ts"

Write-Host ""
Write-Host "CHECK KLYX 12.54"
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
        Name = "12.53 conserve"
        Value = $content.Contains("KLYX_REQUEST_SUMMARY_12_53")
    },
    @{
        Name = "12.54 present"
        Value = $content.Contains("KLYX_CONFIRMATION_GATE_12_54")
    },
    @{
        Name = "12.54 unique"
        Value = (
            (Count-Literal `
                -Text $content `
                -Value "KLYX_CONFIRMATION_GATE_12_54") -eq 1
        )
    },
    @{
        Name = "confirmation required"
        Value = $compact.Contains(
            "constrequiresUserConfirmation=isRequestComplete;"
        )
    },
    @{
        Name = "next step"
        Value = $compact.Contains(
            "constcompletionNextStep=isRequestComplete"
        )
    },
    @{
        Name = "confirm request state"
        Value = $compact.Contains(
            '?\"confirm_request\"'
        )
    },
    @{
        Name = "collect state"
        Value = $compact.Contains(
            ':\"collect_missing_information\";'
        )
    },
    @{
        Name = "automatic execution disabled"
        Value = $compact.Contains(
            "constautomaticExecutionAllowed=false;"
        )
    },
    @{
        Name = "requiresConfirmation exposed"
        Value = $compact.Contains(
            "requiresConfirmation:requiresUserConfirmation,"
        )
    },
    @{
        Name = "nextStep exposed"
        Value = $compact.Contains(
            "nextStep:completionNextStep,"
        )
    },
    @{
        Name = "execution guard exposed"
        Value = $compact.Contains(
            "automaticExecutionAllowed,"
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
    Write-Host "ECHECS :"

    foreach ($name in $failedNames) {
        Write-Host " - $name"
    }

    throw "KLYX 12.54 static checker FAILED."
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
Write-Host "KLYX 12.54 CHECK OK"
Write-Host "Brain Confirmation Gate operationnel."
Write-Host "======================================"
Write-Host ""