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

$keyMatch =
    [regex]::Match(
        $content,
        '(?m)^\s*OPENAI_API_KEY\s*=\s*(.+?)\s*$'
    )

if (
    -not $keyMatch.Success
) {
    throw "13.59 : OPENAI_API_KEY absente. Shadow non active."
}

$key =
    $keyMatch.Groups[1].Value.Trim()

if (
    [string]::IsNullOrWhiteSpace($key)
) {
    throw "13.59 : OPENAI_API_KEY vide. Shadow non active."
}

if (
    $key -match
    '^(replace|your_|example|test|changeme)'
) {
    throw "13.59 : OPENAI_API_KEY semble etre une valeur factice."
}

$backup =
    $envPath +
    ".13-59.bak"

Copy-Item `
    -LiteralPath $envPath `
    -Destination $backup `
    -Force

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
            'KLYX_LLM_SHADOW_ENABLED=1',
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
        "KLYX_LLM_SHADOW_ENABLED=1" +
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

$enabledCount =
    [regex]::Matches(
        $written,
        '(?m)^\s*KLYX_LLM_SHADOW_ENABLED\s*=\s*1\s*$'
    ).Count

if (
    $enabledCount -ne 1
) {
    throw "13.59 : activation shadow non confirmee."
}

Write-Host ""
Write-Host "======================================"
Write-Host "KLYX 13.59 SHADOW ENABLED"
Write-Host "======================================"
Write-Host "OPENAI_API_KEY : CONFIGURED"
Write-Host "Shadow : ENABLED"
Write-Host "User-visible authority : DETERMINISTIC"
Write-Host "Automatic execution : IMPOSSIBLE"
Write-Host "Backup : .env.local.13-59.bak"
Write-Host "======================================"