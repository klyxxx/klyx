$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "CHECK KLYX 12.63b"
Write-Host ""

$pageCandidates = @(
    (Join-Path $projectRoot "app\assistant\page.tsx"),
    (Join-Path $projectRoot "app\brain\page.tsx")
)

$pagePath = $null

foreach ($candidate in $pageCandidates) {
    if (-not (Test-Path -LiteralPath $candidate)) {
        continue
    }

    $candidateContent =
        [System.IO.File]::ReadAllText($candidate)

    if ($candidateContent.Contains(
        "KLYX_EXPLICIT_CONFIRMATION_12_63"
    )) {
        $pagePath = $candidate
        break
    }
}

if (-not $pagePath) {
    throw "Page KLYX 12.63 introuvable."
}

$apiPath = Join-Path `
    $projectRoot `
    "app\api\brain\confirm-request\route.ts"

if (-not (Test-Path -LiteralPath $apiPath)) {
    throw "API confirm-request introuvable."
}

$page =
    [System.IO.File]::ReadAllText($pagePath)

$api =
    [System.IO.File]::ReadAllText($apiPath)

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

$pageCompact = Compact-Code $page
$apiCompact = Compact-Code $api

$checks = @(
    @{
        Name = "12.62 preserved"
        Value = $page.Contains(
            "KLYX_ASSISTANT_READINESS_UI_12_62"
        )
    },
    @{
        Name = "12.63 marker"
        Value = $page.Contains(
            "KLYX_EXPLICIT_CONFIRMATION_12_63"
        )
    },
    @{
        Name = "confirm handler"
        Value = $pageCompact.Contains(
            "asyncfunctionconfirmCurrentRequest()"
        )
    },
    @{
        Name = "readiness required"
        Value = $pageCompact.Contains(
            "!payload.readiness?.isComplete"
        )
    },
    @{
        Name = "conversation required"
        Value = $pageCompact.Contains(
            "if(!conversationId)"
        )
    },
    @{
        Name = "API connected"
        Value = $page.Contains(
            "/api/brain/confirm-request"
        )
    },
    @{
        Name = "button connected"
        Value = $pageCompact.Contains(
            "onConfirm={()=>voidconfirmCurrentRequest()}"
        )
    },
    @{
        Name = "review flow preserved"
        Value = $pageCompact.Contains(
            "openResults();"
        )
    },
    @{
        Name = "API marker"
        Value = $api.Contains(
            "KLYX_CONFIRM_REQUEST_API_12_63"
        )
    },
    @{
        Name = "authenticated client"
        Value = $apiCompact.Contains(
            'requireAccountType(profile,"client");'
        )
    },
    @{
        Name = "conversation ownership"
        Value = (
            $api.Contains(
                '.from("brain_conversations")'
            ) -and
            $api.Contains(
                '.eq("user_id", profile.id)'
            )
        )
    },
    @{
        Name = "confirmation stored"
        Value = $api.Contains(
            '.from("brain_messages")'
        )
    },
    @{
        Name = "confirm action"
        Value = $apiCompact.Contains(
            'action:"confirm_request"'
        )
    },
    @{
        Name = "automatic execution disabled"
        Value = $apiCompact.Contains(
            "automaticExecutionAllowed:false"
        )
    },
    @{
        Name = "no automatic market publish"
        Value = -not $api.Contains(
            "market-publish"
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

    throw "KLYX 12.63b static checker FAILED."
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
Write-Host "KLYX 12.63 CHECK OK"
Write-Host "Explicit Request Confirmation operationnel."
Write-Host "Confirmation utilisateur tracee."
Write-Host "Aucune transaction automatique."
Write-Host "======================================"
Write-Host ""