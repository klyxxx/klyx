$ErrorActionPreference = "Continue"

$projectRoot = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.66d - DIAGNOSTIC TYPESCRIPT"
Write-Host "======================================"
Write-Host ""

$marketPath = Join-Path `
    $projectRoot `
    "app\assistant\market\page.tsx"

$gatePath = Join-Path `
    $projectRoot `
    "app\api\brain\market-publish\route.ts"

$helperPath = Join-Path `
    $projectRoot `
    "lib\brain-market-confirmation.ts"

$oldBuildLog = Join-Path `
    $projectRoot `
    "klyx-build-12-66b.log"

if (-not (Test-Path -LiteralPath $marketPath)) {
    throw "assistant/market/page.tsx introuvable."
}

Write-Host "Fichiers verifies :"
Write-Host " - $marketPath"
Write-Host " - $gatePath"
Write-Host " - $helperPath"
Write-Host ""

$market = [System.IO.File]::ReadAllText(
    $marketPath
)

Write-Host "Etat 12.66 :"

$markers = @(
    "KLYX_PUBLISH_PROOF_WIRING_12_66B",
    "KLYX_PUBLISH_PROOF_PAYLOAD_12_66B",
    "getKlyxPublishProof()",
    "/api/brain/market-publish"
)

foreach ($marker in $markers) {
    if ($market.Contains($marker)) {
        Write-Host "[OK]   $marker"
    }
    else {
        Write-Host "[MISS] $marker"
    }
}

Write-Host ""

# ============================================================
# Lire le précédent log 12.66b s'il existe
# ============================================================

if (Test-Path -LiteralPath $oldBuildLog) {
    Write-Host "Ancien log 12.66b detecte."
    Write-Host ""

    $oldLines = Get-Content `
        -LiteralPath $oldBuildLog

    $oldErrors = $oldLines |
        Select-String `
            -Pattern `
                "Type error",
                "Failed to type check",
                "error TS",
                "is not assignable",
                "Cannot find name",
                "Cannot find module",
                "Property .* does not exist",
                "Expected",
                "Unexpected" `
            -Context 3,8

    if ($oldErrors) {
        Write-Host "ERREUR(S) DANS L'ANCIEN BUILD :"
        Write-Host ""

        foreach ($match in $oldErrors) {
            Write-Host $match
        }

        Write-Host ""
    }
}

# ============================================================
# Nouveau vrai TypeScript check
# ============================================================

Write-Host "======================================"
Write-Host "LANCEMENT npx tsc --noEmit"
Write-Host "======================================"
Write-Host ""

$tsLog = Join-Path `
    $projectRoot `
    "klyx-tsc-12-66d.log"

Push-Location $projectRoot

try {
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

    if ($tsExitCode -eq 0) {
        Write-Host "TYPESCRIPT OK."
        Write-Host ""
        Write-Host "Le probleme vient donc du build Next.js,"
        Write-Host "pas du compilateur TypeScript."
    }
    else {
        Write-Host "TYPESCRIPT FAILED."
        Write-Host ""
        Write-Host "======================================"
        Write-Host "ERREUR TYPESCRIPT EXACTE"
        Write-Host "======================================"
        Write-Host ""

        $important = $tsOutput |
            Where-Object {
                $_ -match "error TS" -or
                $_ -match "app[/\\]" -or
                $_ -match "lib[/\\]" -or
                $_ -match "components[/\\]"
            }

        if ($important) {
            $important |
                Select-Object -First 100 |
                ForEach-Object {
                    Write-Host $_
                }
        }
        else {
            $tsOutput |
                Select-Object -First 100 |
                ForEach-Object {
                    Write-Host $_
                }
        }

        Write-Host ""
        Write-Host "Log TypeScript complet :"
        Write-Host $tsLog
        Write-Host ""

        exit $tsExitCode
    }
}
finally {
    Pop-Location
}

# ============================================================
# Si TypeScript passe, lancer Next build
# ============================================================

Write-Host ""
Write-Host "======================================"
Write-Host "LANCEMENT npm run build"
Write-Host "======================================"
Write-Host ""

$buildLog = Join-Path `
    $projectRoot `
    "klyx-build-12-66d.log"

Push-Location $projectRoot

try {
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
        Write-Host "======================================"
        Write-Host "ERREUR NEXT.JS EXACTE"
        Write-Host "======================================"
        Write-Host ""

        $interesting = $buildOutput |
            Where-Object {
                $_ -match "Type error" -or
                $_ -match "Failed to type check" -or
                $_ -match "Error:" -or
                $_ -match "app[/\\]" -or
                $_ -match "lib[/\\]" -or
                $_ -match "Cannot find" -or
                $_ -match "is not assignable"
            }

        if ($interesting) {
            $interesting |
                Select-Object -First 100 |
                ForEach-Object {
                    Write-Host $_
                }
        }

        Write-Host ""
        Write-Host "Log build complet :"
        Write-Host $buildLog

        exit $buildExitCode
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.66 CHECK OK"
Write-Host "TypeScript valide."
Write-Host "Build Next.js valide."
Write-Host "======================================"
Write-Host ""