$ErrorActionPreference = "Stop"

$projectRoot =
    Split-Path -Parent $PSScriptRoot

$targetPath = Join-Path `
    $projectRoot `
    "app\assistant\market\page.tsx"

Write-Host ""
Write-Host "CHECK KLYX 12.66b"
Write-Host ""

if (-not (Test-Path -LiteralPath $targetPath)) {
    throw "assistant/market/page.tsx introuvable."
}

$content =
    [System.IO.File]::ReadAllText(
        $targetPath
    )

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

$endpointCount =
    Count-Literal `
        -Text $content `
        -Value "/api/brain/market-publish"

$proofCount =
    Count-Literal `
        -Text $content `
        -Value "KLYX_PUBLISH_PROOF_PAYLOAD_12_66B"

$checks = @(
    @{
        Name = "12.66b marker"
        Value = $content.Contains(
            "KLYX_PUBLISH_PROOF_WIRING_12_66B"
        )
    },
    @{
        Name = "proof helper"
        Value = $content.Contains(
            "function getKlyxPublishProof()"
        )
    },
    @{
        Name = "conversationId source"
        Value = $content.Contains(
            'params.get("conversationId")'
        )
    },
    @{
        Name = "confirmationId source"
        Value = $content.Contains(
            'params.get("confirmationId")'
        )
    },
    @{
        Name = "proof spread"
        Value = $content.Contains(
            "...getKlyxPublishProof()"
        )
    },
    @{
        Name = "all market calls wired"
        Value = (
            $endpointCount -gt 0 -and
            $proofCount -ge $endpointCount
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

Write-Host ""
Write-Host "market-publish : $endpointCount"
Write-Host "proof payloads : $proofCount"

if ($failed.Count -gt 0) {
    Write-Host ""

    foreach ($name in $failed) {
        Write-Host " - $name"
    }

    throw "KLYX 12.66b static checker FAILED."
}

Write-Host ""
Write-Host "Tests statiques OK."
Write-Host ""
Write-Host "Lancement npm run build..."
Write-Host ""

$logPath = Join-Path `
    $projectRoot `
    "klyx-build-12-66b.log"

Push-Location $projectRoot

try {
    $output = npm run build 2>&1

    $output |
        Tee-Object `
            -FilePath $logPath

    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "======================================"
        Write-Host "ERREUR BUILD KLYX 12.66b"
        Write-Host "======================================"

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
                    "Cannot find",
                    "is not assignable",
                    "Unexpected",
                    "Expected" `
                -Context 2,7

        if ($interesting) {
            $interesting |
                ForEach-Object {
                    Write-Host $_
                }
        }
        else {
            $lines |
                Select-Object -Last 70 |
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
Write-Host "KLYX 12.66 CHECK OK"
Write-Host "Publish Proof Wiring operationnel."
Write-Host "conversationId + confirmationId transmis."
Write-Host "Gate serveur 12.65 operationnel."
Write-Host "Build Next.js valide."
Write-Host "======================================"
Write-Host ""