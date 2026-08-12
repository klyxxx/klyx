$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$targetPath = Join-Path $projectRoot "app\api\brain\respond\route.ts"

Write-Host ""
Write-Host "CHECK KLYX 12.53b"
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
        Name = "12.49"
        Value = $content.Contains("KLYX_COMPLETENESS_12_49")
    },
    @{
        Name = "12.50"
        Value = $content.Contains("KLYX_READINESS_12_50")
    },
    @{
        Name = "12.51"
        Value = $content.Contains("KLYX_GUIDED_COMPLETION_12_51")
    },
    @{
        Name = "12.52"
        Value = $content.Contains("KLYX_PROGRESS_FEEDBACK_12_52")
    },
    @{
        Name = "12.53 marker"
        Value = $content.Contains("KLYX_REQUEST_SUMMARY_12_53")
    },
    @{
        Name = "12.53 marker unique"
        Value = (
            (Count-Literal `
                -Text $content `
                -Value "KLYX_REQUEST_SUMMARY_12_53") -eq 1
        )
    },
    @{
        Name = "summary variable"
        Value = $compact.Contains(
            "constcompletionRequestSummary=isRequestComplete"
        )
    },
    @{
        Name = "summary service"
        Value = $compact.Contains(
            "service:context.serviceSlug,"
        )
    },
    @{
        Name = "summary city"
        Value = $compact.Contains(
            "city:context.city,"
        )
    },
    @{
        Name = "summary date"
        Value = $compact.Contains(
            "date:context.date,"
        )
    },
    @{
        Name = "summary time"
        Value = $compact.Contains(
            "time:context.time,"
        )
    },
    @{
        Name = "confirmation variable"
        Value = $compact.Contains(
            "constcompletionConfirmationText=isRequestComplete"
        )
    },
    @{
        Name = "summary exposed"
        Value = $compact.Contains(
            "summary:completionRequestSummary,"
        )
    },
    @{
        Name = "confirmation exposed"
        Value = $compact.Contains(
            "confirmationText:completionConfirmationText,"
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

    throw "KLYX 12.53b static checker FAILED."
}

Write-Host ""
Write-Host "Tests statiques 12.53 OK."
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