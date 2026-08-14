$ErrorActionPreference = "Stop"

$projectRoot =
    Split-Path -Parent $PSScriptRoot

$globalsPath =
    Join-Path $projectRoot "app\globals.css"

Write-Host ""
Write-Host "CHECK KLYX 12.67d"
Write-Host ""

$content =
    [System.IO.File]::ReadAllText(
        $globalsPath
    )

if (-not $content.Contains(
    "KLYX_FIXED_SIDEBAR_REPAIR_12_67D"
)) {
    throw "12.67d absent."
}

if (-not $content.Contains(
    'position: fixed !important;'
)) {
    throw "Sidebar non fixed."
}

if (-not $content.Contains(
    'overflow: hidden !important;'
)) {
    throw "Protection scroll sidebar absente."
}

if ($content.Contains(
    'overflow-y: auto !important;'
)) {
    throw "Ancien bug overflow-y auto encore present."
}

Write-Host "[OK] Sidebar fixed"
Write-Host "[OK] Double scroll supprime"
Write-Host "[OK] Header sidebar protege"
Write-Host ""

Push-Location $projectRoot

try {
    Write-Host "TypeScript..."
    Write-Host ""

    $tsOutput = @(
        & npx.cmd `
            tsc `
            --noEmit `
            --pretty false 2>&1
    )

    if ($LASTEXITCODE -ne 0) {
        $tsOutput |
            Select-Object -First 100 |
            ForEach-Object {
                Write-Host $_
            }

        throw "TypeScript FAILED."
    }

    Write-Host "TypeScript OK."
    Write-Host ""
    Write-Host "npm run build..."
    Write-Host ""

    & npm.cmd run build

    if ($LASTEXITCODE -ne 0) {
        throw "Build FAILED."
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 12.67d CHECK OK"
Write-Host "Sidebar fixe sans chevauchement."
Write-Host "Build valide."
Write-Host "======================================"
Write-Host ""