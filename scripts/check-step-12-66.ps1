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
Write-Host "CHECK KLYX 12.66"
Write-Host ""

if (-not (Test-Path -LiteralPath $routePath)) {
    throw "Route 12.65 introuvable."
}

if (-not (Test-Path -LiteralPath $helperPath)) {
    throw "Helper 12.65 introuvable."
}

$route =
    [System.IO.File]::ReadAllText(
        $routePath
    )

$helper =
    [System.IO.File]::ReadAllText(
        $helperPath
    )

if (-not $route.Contains(
    "KLYX_MARKET_CONFIRMATION_GATE_12_65"
)) {
    throw "Gate 12.65 absent."
}

if (-not $helper.Contains(
    "KLYX_MARKET_CONFIRMATION_HELPER_12_65"
)) {
    throw "Helper 12.65 absent."
}

$searchRoots = @(
    (Join-Path $projectRoot "app"),
    (Join-Path $projectRoot "components"),
    (Join-Path $projectRoot "lib")
)

$callers = @()

$routeFull =
    [System.IO.Path]::GetFullPath(
        $routePath
    )

foreach ($root in $searchRoots) {
    if (-not (Test-Path -LiteralPath $root)) {
        continue
    }

    $files =
        Get-ChildItem `
            -LiteralPath $root `
            -Recurse `
            -File `
            -ErrorAction SilentlyContinue |
        Where-Object {
            (
                $_.Extension -eq ".ts" -or
                $_.Extension -eq ".tsx"
            ) -and
            -not $_.Name.Contains(".bak-")
        }

    foreach ($file in $files) {
        $full =
            [System.IO.Path]::GetFullPath(
                $file.FullName
            )

        if ($full -eq $routeFull) {
            continue
        }

        $content =
            [System.IO.File]::ReadAllText(
                $file.FullName
            )

        if ($content.Contains(
            "/api/brain/market-publish"
        )) {
            $callers += $file.FullName
        }
    }
}

$callers = @(
    $callers |
    Sort-Object -Unique
)

if ($callers.Count -eq 0) {
    throw "Aucun appel market-publish trouve apres 12.66."
}

$failed = @()

foreach ($caller in $callers) {
    $content =
        [System.IO.File]::ReadAllText(
            $caller
        )

    Write-Host ""
    Write-Host "Verification : $caller"

    $checks = @(
        @{
            Name = "12.66 marker"
            Value = $content.Contains(
                "KLYX_PUBLISH_PROOF_WIRING_12_66"
            )
        },
        @{
            Name = "market publish call"
            Value = $content.Contains(
                "/api/brain/market-publish"
            )
        },
        @{
            Name = "conversation proof"
            Value = (
                $content.Contains(
                    "conversationId"
                ) -and
                $content.Contains(
                    'get("conversationId")'
                )
            )
        },
        @{
            Name = "confirmation proof"
            Value = (
                $content.Contains(
                    "confirmationId"
                ) -and
                $content.Contains(
                    'get("confirmationId")'
                )
            )
        },
        @{
            Name = "browser guard"
            Value = $content.Contains(
                'typeof window !== "undefined"'
            )
        }
    )

    foreach ($check in $checks) {
        if ($check.Value) {
            Write-Host "[OK]   $($check.Name)"
        }
        else {
            Write-Host "[FAIL] $($check.Name)"
            $failed += (
                $caller +
                " -> " +
                $check.Name
            )
        }
    }
}

if ($failed.Count -gt 0) {
    Write-Host ""
    Write-Host "ECHECS :"

    foreach ($failure in $failed) {
        Write-Host " - $failure"
    }

    throw "KLYX 12.66 static checker FAILED."
}

Write-Host ""
Write-Host "Tous les appels market-publish transportent la preuve."
Write-Host ""
Write-Host "Lancement npm run build..."
Write-Host ""

$logPath = Join-Path `
    $projectRoot `
    "klyx-build-12-66.log"

Push-Location $projectRoot

try {
    $output = npm run build 2>&1

    $output |
        Tee-Object `
            -FilePath $logPath

    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "======================================"
        Write-Host "ERREUR BUILD KLYX 12.66"
        Write-Host "======================================"

        $lines = @($output)

        $interesting =
            $lines |
            Select-String `
                -Pattern `
                    "Type error",
                    "Error:",
                    "./app/",
                    "./components/",
                    "./lib/",
                    "Failed to compile",
                    "Cannot find",
                    "is not assignable",
                    "Unexpected",
                    "Expected" `
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
Write-Host "KLYX 12.66 CHECK OK"
Write-Host "Publish Proof Wiring operationnel."
Write-Host "market-publish recoit la preuve 12.64."
Write-Host "Gate serveur 12.65 reste obligatoire."
Write-Host "Build Next.js valide."
Write-Host "======================================"
Write-Host ""