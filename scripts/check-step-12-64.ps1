$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

$apiPath = Join-Path `
    $projectRoot `
    "app\api\brain\confirm-request\route.ts"

$confirmPagePath = Join-Path `
    $projectRoot `
    "app\request\confirm\page.tsx"

$pageCandidates = @(
    (Join-Path $projectRoot "app\assistant\page.tsx"),
    (Join-Path $projectRoot "app\brain\page.tsx")
)

$assistantPath = $null

foreach ($candidate in $pageCandidates) {
    if (-not (Test-Path $candidate)) {
        continue
    }

    $text = [System.IO.File]::ReadAllText($candidate)

    if ($text.Contains("KLYX_CONFIRMATION_PROOF_12_64")) {
        $assistantPath = $candidate
        break
    }
}

Write-Host ""
Write-Host "CHECK KLYX 12.64"
Write-Host ""

if (-not $assistantPath) {
    throw "Assistant 12.64 introuvable."
}

if (-not (Test-Path $apiPath)) {
    throw "confirm-request API introuvable."
}

if (-not (Test-Path $confirmPagePath)) {
    throw "request/confirm introuvable."
}

$api = [System.IO.File]::ReadAllText($apiPath)
$assistant = [System.IO.File]::ReadAllText($assistantPath)
$confirm = [System.IO.File]::ReadAllText($confirmPagePath)

function Compact-Code {
    param([string]$Text)

    $builder =
        New-Object System.Text.StringBuilder

    foreach ($char in $Text.ToCharArray()) {
        if (-not [char]::IsWhiteSpace($char)) {
            [void]$builder.Append($char)
        }
    }

    return $builder.ToString()
}

$apiCompact = Compact-Code $api
$assistantCompact = Compact-Code $assistant
$confirmCompact = Compact-Code $confirm

$checks = @(
    @{
        Name = "12.63 preserved"
        Value = $api.Contains(
            "KLYX_CONFIRM_REQUEST_API_12_63"
        )
    },
    @{
        Name = "12.64 API marker"
        Value = $api.Contains(
            "KLYX_CONFIRMATION_PROOF_12_64"
        )
    },
    @{
        Name = "confirmation message id selected"
        Value = $apiCompact.Contains(
            '.select("id").single();'
        )
    },
    @{
        Name = "confirmationId returned"
        Value = $apiCompact.Contains(
            "confirmationId,"
        )
    },
    @{
        Name = "assistant receives confirmationId"
        Value = $assistantCompact.Contains(
            "confirmationId?:string;"
        )
    },
    @{
        Name = "assistant validates proof"
        Value = $assistant.Contains(
            "Preuve de confirmation KLYX manquante."
        )
    },
    @{
        Name = "openResults receives proof"
        Value = $assistantCompact.Contains(
            "openResults(result.confirmationId);"
        )
    },
    @{
        Name = "conversation propagated"
        Value = $assistantCompact.Contains(
            'params.set("conversationId",conversationId);'
        )
    },
    @{
        Name = "confirmation proof propagated"
        Value = $assistantCompact.Contains(
            'params.set("confirmationId",confirmationId);'
        )
    },
    @{
        Name = "request confirm reads conversation"
        Value = $confirmCompact.Contains(
            'searchParams.get("conversationId")'
        )
    },
    @{
        Name = "request confirm reads confirmation"
        Value = $confirmCompact.Contains(
            'searchParams.get("confirmationId")'
        )
    },
    @{
        Name = "recommendations keeps conversation"
        Value = $confirmCompact.Contains(
            'params.set("conversationId",conversationId);'
        )
    },
    @{
        Name = "recommendations keeps confirmation"
        Value = $confirmCompact.Contains(
            'params.set("confirmationId",confirmationId);'
        )
    },
    @{
        Name = "no Stripe in confirmation API"
        Value = -not $api.ToLower().Contains("stripe")
    },
    @{
        Name = "no automatic market publish"
        Value = -not $api.Contains("market-publish")
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

    throw "KLYX 12.64 static checker FAILED."
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
Write-Host "KLYX 12.64 CHECK OK"
Write-Host "Confirmation Proof Propagation operationnel."
Write-Host "confirmationId transporte jusqu'aux recommandations."
Write-Host "======================================"
Write-Host ""