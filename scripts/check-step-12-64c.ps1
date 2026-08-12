$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

$pageCandidates = @(
    (Join-Path $projectRoot "app\assistant\page.tsx"),
    (Join-Path $projectRoot "app\brain\page.tsx")
)

$pagePath = $null

foreach ($candidate in $pageCandidates) {
    if (-not (Test-Path -LiteralPath $candidate)) {
        continue
    }

    $text = [System.IO.File]::ReadAllText($candidate)

    if ($text.Contains(
        "KLYX_OPEN_RESULTS_HANDLER_REPAIR_12_64C"
    )) {
        $pagePath = $candidate
        break
    }
}

Write-Host ""
Write-Host "CHECK KLYX 12.64c"
Write-Host ""

if (-not $pagePath) {
    throw "Page 12.64c introuvable."
}

$content =
    [System.IO.File]::ReadAllText($pagePath)

$checks = @(
    @{
        Name = "12.64 preserved"
        Value = $content.Contains(
            "KLYX_CONFIRMATION_PROOF_12_64"
        )
    },
    @{
        Name = "12.64c marker"
        Value = $content.Contains(
            "KLYX_OPEN_RESULTS_HANDLER_REPAIR_12_64C"
        )
    },
    @{
        Name = "openResults accepts confirmationId"
        Value = $content.Contains(
            "function openResults(confirmationId?: string)"
        )
    },
    @{
        Name = "confirmation uses confirmationId"
        Value = $content.Contains(
            "openResults(confirmationId);"
        )
    },
    @{
        Name = "no direct React handler"
        Value = -not $content.Contains(
            "onClick={openResults}"
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

    throw "KLYX 12.64c static checker FAILED."
}

Write-Host ""
Write-Host "Tests statiques OK."
Write-Host ""
Write-Host "Lancement npm run build..."
Write-Host ""

$logPath = Join-Path `
    $projectRoot `
    "klyx-build-12-64c.log"

Push-Location $projectRoot

try {
    $output = npm run build 2>&1

    $output |
        Tee-Object `
            -FilePath $logPath

    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "======================================"
        Write-Host "ERREUR BUILD KLYX"
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
                    "Expected",
                    "Unexpected",
                    "Cannot find",
                    "is not assignable" `
                -Context 2,5

        if ($interesting) {
            $interesting |
                ForEach-Object {
                    Write-Host $_
                }
        }
        else {
            Write-Host "Dernieres lignes du build :"

            $lines |
                Select-Object -Last 50 |
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
Write-Host "KLYX 12.64 CHECK OK"
Write-Host "Confirmation Proof Propagation operationnel."
Write-Host "Build Next.js valide."
Write-Host "======================================"
Write-Host ""