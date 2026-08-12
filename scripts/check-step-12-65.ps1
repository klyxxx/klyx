$ErrorActionPreference = "Stop"

$projectRoot =
    Split-Path -Parent $PSScriptRoot

$routePath = Join-Path `
    $projectRoot `
    "app\api\brain\market-publish\route.ts"

$helperPath = Join-Path `
    $projectRoot `
    "lib\brain-market-confirmation.ts"

Write-Host ""
Write-Host "CHECK KLYX 12.65"
Write-Host ""

if (-not (Test-Path -LiteralPath $routePath)) {
    throw "market-publish route introuvable."
}

if (-not (Test-Path -LiteralPath $helperPath)) {
    throw "brain-market-confirmation.ts introuvable."
}

$route =
    [System.IO.File]::ReadAllText($routePath)

$helper =
    [System.IO.File]::ReadAllText($helperPath)

function Compact-Code {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Text
    )

    $builder =
        New-Object System.Text.StringBuilder

    foreach ($char in $Text.ToCharArray()) {
        if (-not [char]::IsWhiteSpace($char)) {
            [void]$builder.Append($char)
        }
    }

    return $builder.ToString()
}

function Count-Literal {
    param(
        [string]$Text,
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
        $position =
            $index + $Value.Length
    }

    return $count
}

$routeCompact = Compact-Code $route
$helperCompact = Compact-Code $helper

$checks = @(
    @{
        Name = "12.65 route marker"
        Value = $route.Contains(
            "KLYX_MARKET_CONFIRMATION_GATE_12_65"
        )
    },
    @{
        Name = "route marker unique"
        Value = (
            (Count-Literal `
                $route `
                "KLYX_MARKET_CONFIRMATION_GATE_12_65") -eq 1
        )
    },
    @{
        Name = "12.65 helper marker"
        Value = $helper.Contains(
            "KLYX_MARKET_CONFIRMATION_HELPER_12_65"
        )
    },
    @{
        Name = "helper imported"
        Value = $route.Contains(
            "@/lib/brain-market-confirmation"
        )
    },
    @{
        Name = "request cloned"
        Value = $route.Contains(
            ".clone();"
        )
    },
    @{
        Name = "gate executed"
        Value = $route.Contains(
            "await requireBrainMarketConfirmation({"
        )
    },
    @{
        Name = "client authentication"
        Value = $helperCompact.Contains(
            'requireAccountType(profile,"client");'
        )
    },
    @{
        Name = "conversation proof required"
        Value = $helper.Contains(
            "conversationId"
        )
    },
    @{
        Name = "confirmation proof required"
        Value = $helper.Contains(
            "confirmationId"
        )
    },
    @{
        Name = "conversation ownership"
        Value = (
            $helper.Contains(
                '.from("brain_conversations")'
            ) -and
            $helper.Contains(
                '.eq("user_id", profile.id)'
            )
        )
    },
    @{
        Name = "confirmation message verified"
        Value = (
            $helper.Contains(
                '.from("brain_messages")'
            ) -and
            $helper.Contains(
                '.eq("conversation_id", conversationId)'
            )
        )
    },
    @{
        Name = "explicit action required"
        Value = $helperCompact.Contains(
            'payload.action!=="confirm_request"'
        )
    },
    @{
        Name = "confirmed true required"
        Value = $helperCompact.Contains(
            "payload.confirmed!==true"
        )
    },
    @{
        Name = "automatic execution remains false"
        Value = $helperCompact.Contains(
            "payload.automaticExecutionAllowed!==false"
        )
    },
    @{
        Name = "request snapshot compared"
        Value = $helper.Contains(
            "snapshotsMatch"
        )
    },
    @{
        Name = "changed request rejected"
        Value = $helper.Contains(
            "La demande a change depuis sa confirmation"
        )
    },
    @{
        Name = "no Stripe in gate"
        Value = -not $helper.ToLower().Contains(
            "stripe"
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

    foreach ($name in $failed) {
        Write-Host " - $name"
    }

    throw "KLYX 12.65 static checker FAILED."
}

Write-Host ""
Write-Host "Tests statiques OK."
Write-Host ""
Write-Host "Lancement npm run build..."
Write-Host ""

$logPath = Join-Path `
    $projectRoot `
    "klyx-build-12-65.log"

Push-Location $projectRoot

try {
    $output = npm run build 2>&1

    $output |
        Tee-Object -FilePath $logPath

    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "======================================"
        Write-Host "ERREUR BUILD KLYX 12.65"
        Write-Host "======================================"
        Write-Host ""

        $lines = @($output)

        $interesting =
            $lines |
            Select-String `
                -Pattern `
                    "Type error",
                    "Error:",
                    "./app/",
                    "./lib/",
                    "Failed to compile",
                    "Module not found",
                    "Cannot find",
                    "is not assignable",
                    "Expected",
                    "Unexpected" `
                -Context 2,6

        if ($interesting) {
            $interesting |
                ForEach-Object {
                    Write-Host $_
                }
        }
        else {
            $lines |
                Select-Object -Last 60 |
                ForEach-Object {
                    Write-Host $_
                }
        }

        Write-Host ""
        Write-Host "Log complet : $logPath"
        Write-Host ""

        throw "npm run build a echoue avec le code $LASTEXITCODE."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.65 CHECK OK"
Write-Host "Market Publish Confirmation Gate operationnel."
Write-Host "Publication protegee par confirmation explicite."
Write-Host "Build Next.js valide."
Write-Host "======================================"
Write-Host ""