$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

$apiPath = Join-Path `
    $projectRoot `
    "app\api\brain\confirm-request\route.ts"

$confirmPath = Join-Path `
    $projectRoot `
    "app\request\confirm\page.tsx"

$pageCandidates = @(
    (Join-Path $projectRoot "app\assistant\page.tsx"),
    (Join-Path $projectRoot "app\brain\page.tsx")
)

$assistantPath = $null

foreach ($candidate in $pageCandidates) {
    if (-not (Test-Path -LiteralPath $candidate)) {
        continue
    }

    $text =
        [System.IO.File]::ReadAllText($candidate)

    if ($text.Contains(
        "KLYX_CONFIRMATION_PROOF_12_64"
    )) {
        $assistantPath = $candidate
        break
    }
}

Write-Host ""
Write-Host "CHECK KLYX 12.64b"
Write-Host ""

if (-not $assistantPath) {
    throw "Assistant 12.64 introuvable."
}

if (-not (Test-Path -LiteralPath $apiPath)) {
    throw "API confirmation introuvable."
}

if (-not (Test-Path -LiteralPath $confirmPath)) {
    throw "request/confirm introuvable."
}

$api =
    [System.IO.File]::ReadAllText($apiPath)

$assistant =
    [System.IO.File]::ReadAllText($assistantPath)

$confirm =
    [System.IO.File]::ReadAllText($confirmPath)

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

$apiCompact = Compact-Code $api
$assistantCompact = Compact-Code $assistant
$confirmCompact = Compact-Code $confirm

$checks = @(
    @{
        Name = "12.63 API preserved"
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
        Name = "confirmation row selected"
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
        Name = "no fragile result type dependency"
        Value = $assistantCompact.Contains(
            "resultas{confirmationId?:string}"
        )
    },
    @{
        Name = "proof required"
        Value = $assistant.Contains(
            "Preuve de confirmation KLYX manquante."
        )
    },
    @{
        Name = "proof sent to openResults"
        Value = $assistantCompact.Contains(
            "openResults(confirmationId);"
        )
    },
    @{
        Name = "openResults accepts proof"
        Value = $assistantCompact.Contains(
            "functionopenResults(confirmationId?:string)"
        )
    },
    @{
        Name = "conversation propagated"
        Value = $assistantCompact.Contains(
            'params.set("conversationId",conversationId);'
        )
    },
    @{
        Name = "confirmation propagated"
        Value = $assistantCompact.Contains(
            'params.set("confirmationId",confirmationId);'
        )
    },
    @{
        Name = "confirm page reads conversationId"
        Value = $confirmCompact.Contains(
            'searchParams.get("conversationId")'
        )
    },
    @{
        Name = "confirm page reads confirmationId"
        Value = $confirmCompact.Contains(
            'searchParams.get("confirmationId")'
        )
    },
    @{
        Name = "recommendations receives conversation"
        Value = $confirmCompact.Contains(
            'params.set("conversationId",conversationId);'
        )
    },
    @{
        Name = "recommendations receives proof"
        Value = $confirmCompact.Contains(
            'params.set("confirmationId",confirmationId);'
        )
    },
    @{
        Name = "automatic execution disabled"
        Value = $apiCompact.Contains(
            "automaticExecutionAllowed:false"
        )
    },
    @{
        Name = "no Stripe"
        Value = -not $api.ToLower().Contains(
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
    Write-Host "ECHECS :"

    foreach ($name in $failed) {
        Write-Host " - $name"
    }

    throw "KLYX 12.64b static checker FAILED."
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