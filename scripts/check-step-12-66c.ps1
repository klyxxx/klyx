$ErrorActionPreference = "Stop"

$projectRoot =
    Split-Path -Parent $PSScriptRoot

$targetPath = Join-Path `
    $projectRoot `
    "app\assistant\market\page.tsx"

Write-Host ""
Write-Host "CHECK KLYX 12.66c"
Write-Host ""

if (-not (Test-Path -LiteralPath $targetPath)) {
    throw "assistant/market/page.tsx introuvable."
}

$content =
    [System.IO.File]::ReadAllText(
        $targetPath
    )

$checks = @(
    @{
        Name = "12.66c marker"
        Value = $content.Contains(
            "KLYX_PUBLISH_PROOF_WIRING_12_66C"
        )
    },
    @{
        Name = "conversationId wired"
        Value = $content.Contains(
            'get("conversationId")'
        )
    },
    @{
        Name = "confirmationId wired"
        Value = $content.Contains(
            'get("confirmationId")'
        )
    },
    @{
        Name = "market publish preserved"
        Value = $content.Contains(
            "/api/brain/market-publish"
        )
    },
    @{
        Name = "old helper removed"
        Value = -not $content.Contains(
            "getKlyxPublishProof()"
        )
    },
    @{
        Name = "window dependency removed"
        Value = -not $content.Contains(
            'typeof window !== "undefined"'
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
    foreach ($name in $failed) {
        Write-Host " - $name"
    }

    throw "KLYX 12.66c static checker FAILED."
}

Push-Location $projectRoot

try {
    Write-Host ""
    Write-Host "TypeScript check..."
    Write-Host ""

    $tsLog = Join-Path `
        $projectRoot `
        "klyx-tsc-12-66c.log"

    $tsOutput =
        npx tsc --noEmit --pretty false 2>&1

    $tsOutput |
        Tee-Object -FilePath $tsLog

    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "======================================"
        Write-Host "ERREUR TYPESCRIPT REELLE"
        Write-Host "======================================"

        @($tsOutput) |
            Select-Object -First 80 |
            ForEach-Object {
                Write-Host $_
            }

        Write-Host ""
        Write-Host "Log : $tsLog"

        throw "KLYX 12.66c TypeScript check FAILED."
    }

    Write-Host ""
    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    $buildLog = Join-Path `
        $projectRoot `
        "klyx-build-12-66c.log"

    $buildOutput =
        npm run build 2>&1

    $buildOutput |
        Tee-Object -FilePath $buildLog

    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "======================================"
        Write-Host "ERREUR BUILD REELLE"
        Write-Host "======================================"

        @($buildOutput) |
            Select-Object -Last 100 |
            ForEach-Object {
                Write-Host $_
            }

        Write-Host ""
        Write-Host "Log : $buildLog"

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
Write-Host "TypeScript valide."
Write-Host "Build Next.js valide."
Write-Host "======================================"
Write-Host ""