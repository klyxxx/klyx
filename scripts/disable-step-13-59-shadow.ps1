$ErrorActionPreference = "Stop"

$root =
    Split-Path -Parent $PSScriptRoot

Set-Location $root

$envPath =
    Join-Path $root ".env.local"

if (
    -not (
        Test-Path `
            -LiteralPath $envPath `
            -PathType Leaf
    )
) {
    throw "13.59 : .env.local introuvable."
}

$content =
    [System.IO.File]::ReadAllText(
        $envPath
    )

$pattern =
    '(?m)^\s*KLYX_LLM_SHADOW_ENABLED\s*=.*$'

if (
    [regex]::IsMatch(
        $content,
        $pattern
    )
) {
    $content =
        [regex]::Replace(
            $content,
            $pattern,
            'KLYX_LLM_SHADOW_ENABLED=0',
            1
        )
}
else {
    if (
        -not $content.EndsWith(
            [Environment]::NewLine
        )
    ) {
        $content +=
            [Environment]::NewLine
    }

    $content +=
        "KLYX_LLM_SHADOW_ENABLED=0" +
        [Environment]::NewLine
}

$utf8 =
    New-Object System.Text.UTF8Encoding($false)

[System.IO.File]::WriteAllText(
    $envPath,
    $content,
    $utf8
)

$written =
    [System.IO.File]::ReadAllText(
        $envPath
    )

if (
    -not (
        [regex]::IsMatch(
            $written,
            '(?m)^\s*KLYX_LLM_SHADOW_ENABLED\s*=\s*0\s*$'
        )
    )
) {
    throw "13.59 : desactivation non confirmee."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.59 SHADOW DISABLED"
Write-Host "======================================"
Write-Host "Shadow : DISABLED"
Write-Host "Brain deterministic : ACTIVE"
Write-Host "Automatic execution : IMPOSSIBLE"
Write-Host "======================================"