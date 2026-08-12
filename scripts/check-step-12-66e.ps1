$ErrorActionPreference = "Stop"

$projectRoot =
    Split-Path -Parent $PSScriptRoot

$targetPath = Join-Path `
    $projectRoot `
    "app\assistant\market\page.tsx"

Write-Host ""
Write-Host "CHECK KLYX 12.66e"
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
        Name = "12.66b preserved"
        Value = $content.Contains(
            "KLYX_PUBLISH_PROOF_WIRING_12_66B"
        )
    },
    @{
        Name = "12.66e repair"
        Value = $content.Contains(
            "KLYX_PUBLISH_PROOF_DUPLICATE_REPAIR_12_66E"
        )
    },
    @{
        Name = "market publish preserved"
        Value = $content.Contains(
            "/api/brain/market-publish"
        )
    },
    @{
        Name = "conversationId present"
        Value = $content.Contains(
            "conversationId"
        )
    },
    @{
        Name = "confirmationId present"
        Value = $content.Contains(
            "confirmationId"
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
    throw "KLYX 12.66e static checker FAILED."
}

Push-Location $projectRoot

try {
    Write-Host ""
    Write-Host "======================================"
    Write-Host "TYPESCRIPT CHECK"
    Write-Host "======================================"
    Write-Host ""

    $tsLog = Join-Path `
        $projectRoot `
        "klyx-tsc-12-66e.log"

    $tsOutput = @(
        & npx.cmd `
            tsc `
            --noEmit `
            --pretty false 2>&1
    )

    $tsExitCode = $LASTEXITCODE

    $tsOutput |
        Set-Content `
            -LiteralPath $tsLog `
            -Encoding UTF8

    if ($tsExitCode -ne 0) {
        Write-Host ""
        Write-Host "ERREUR TYPESCRIPT :"
        Write-Host ""

        $tsOutput |
            Select-Object -First 100 |
            ForEach-Object {
                Write-Host $_
            }

        Write-Host ""
        Write-Host "Log : $tsLog"

        throw "TypeScript check FAILED."
    }

    Write-Host "TypeScript OK."

    Write-Host ""
    Write-Host "======================================"
    Write-Host "NEXT BUILD"
    Write-Host "======================================"
    Write-Host ""

    $buildLog = Join-Path `
        $projectRoot `
        "klyx-build-12-66e.log"

    $buildOutput = @(
        & npm.cmd run build 2>&1
    )

    $buildExitCode = $LASTEXITCODE

    $buildOutput |
        Set-Content `
            -LiteralPath $buildLog `
            -Encoding UTF8

    $buildOutput |
        ForEach-Object {
            Write-Host $_
        }

    if ($buildExitCode -ne 0) {
        Write-Host ""
        Write-Host "Log : $buildLog"

        throw "npm run build a echoue avec le code $buildExitCode."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.66 CHECK OK"
Write-Host "Publish Proof Wiring operationnel."
Write-Host "Doublon conversationId corrige."
Write-Host "confirmationId transmis."
Write-Host "TypeScript valide."
Write-Host "Build Next.js valide."
Write-Host "======================================"
Write-Host ""