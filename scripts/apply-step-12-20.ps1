$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.20 - SUPPORT + SUPPRESSION UNIQUE" -ForegroundColor Cyan
Write-Host ""

$oldEmail = "klyx237@gmail.com"
$newEmail = "klyxsupport@gmail.com"

# ============================================================
# 1. REMPLACER L'ANCIENNE ADRESSE DANS LE CODE ACTIF
# ============================================================

$extensions = @(
    "*.ts",
    "*.tsx",
    "*.js",
    "*.jsx",
    "*.json",
    "*.md",
    "*.txt"
)

$files = Get-ChildItem `
    -Path $root `
    -Recurse `
    -File `
    -Include $extensions |
Where-Object {
    $_.FullName -notmatch "\\node_modules\\" -and
    $_.FullName -notmatch "\\\.next\\" -and
    $_.FullName -notmatch "\\\.git\\" -and
    $_.FullName -notmatch "\\payload\\" -and
    $_.FullName -notmatch "\.bak$" -and
    $_.FullName -notmatch "-current\.txt$"
}

foreach ($file in $files) {
    $content = Get-Content -LiteralPath $file.FullName -Raw

    if (
        $null -ne $content -and
        $content.Contains($oldEmail)
    ) {
        $content = $content.Replace(
            $oldEmail,
            $newEmail
        )

        [System.IO.File]::WriteAllText(
            $file.FullName,
            $content,
            [System.Text.UTF8Encoding]::new($false)
        )

        Write-Host "[EMAIL] $($file.FullName)" -ForegroundColor Green
    }
}

# ============================================================
# 2. .ENV.LOCAL
# ============================================================

$envPath = Join-Path $root ".env.local"

if (Test-Path -LiteralPath $envPath) {
    $envContent = Get-Content -LiteralPath $envPath -Raw

    if (
        $envContent -match "(?m)^NEXT_PUBLIC_SUPPORT_EMAIL="
    ) {
        $envContent = [regex]::Replace(
            $envContent,
            "(?m)^NEXT_PUBLIC_SUPPORT_EMAIL=.*$",
            "NEXT_PUBLIC_SUPPORT_EMAIL=$newEmail"
        )
    }
    else {
        if (
            $envContent.Length -gt 0 -and
            -not $envContent.EndsWith("`n")
        ) {
            $envContent += "`r`n"
        }

        $envContent += "NEXT_PUBLIC_SUPPORT_EMAIL=$newEmail`r`n"
    }

    [System.IO.File]::WriteAllText(
        $envPath,
        $envContent,
        [System.Text.UTF8Encoding]::new($false)
    )

    Write-Host "[OK] .env.local" -ForegroundColor Green
}

# ============================================================
# 3. PAGE SUPPORT
# ============================================================

$supportPath = Join-Path $root "app\support\page.tsx"

if (-not (Test-Path -LiteralPath $supportPath)) {
    throw "Fichier introuvable : app\support\page.tsx"
}

$support = Get-Content -LiteralPath $supportPath -Raw

# ------------------------------------------------------------
# Supprime une éventuelle entrée de tableau dédiée
# à la suppression de compte.
# ------------------------------------------------------------

$support = [regex]::Replace(
    $support,
    '(?ms)\{\s*[^{}]*?(?:title|label|name)\s*:\s*["'']Suppression["''][^{}]*?\},?',
    ""
)

$support = [regex]::Replace(
    $support,
    '(?ms)\{\s*[^{}]*?(?:title|label|name)\s*:\s*["'']Suppression du compte["''][^{}]*?\},?',
    ""
)

# ------------------------------------------------------------
# Supprime une carte JSX contenant explicitement
# "Suppression" et pointant vers /delete-account.
# ------------------------------------------------------------

$support = [regex]::Replace(
    $support,
    '(?ms)<Link\b(?=[^>]*href=["'']/delete-account["''])[^>]*>.*?</Link>',
    ""
)

# ------------------------------------------------------------
# Nettoyage de l'import Trash2 s'il n'est plus utilisé.
# ------------------------------------------------------------

$trashOccurrences = (
    [regex]::Matches(
        $support,
        '\bTrash2\b'
    )
).Count

if ($trashOccurrences -eq 1) {
    $support = [regex]::Replace(
        $support,
        '(?m)^\s*Trash2,\s*\r?\n',
        ""
    )

    $support = [regex]::Replace(
        $support,
        '(?m),\s*Trash2(?=\s*\})',
        ""
    )

    $support = [regex]::Replace(
        $support,
        '(?m)Trash2,\s*',
        ""
    )
}

[System.IO.File]::WriteAllText(
    $supportPath,
    $support,
    [System.Text.UTF8Encoding]::new($false)
)

Write-Host "[OK] Carte Suppression retiree du support" -ForegroundColor Green

# ============================================================
# 4. VERIFICATION RAPIDE
# ============================================================

$remaining = Get-ChildItem `
    -Path (Join-Path $root "app"), (Join-Path $root "lib") `
    -Recurse `
    -File `
    -Include *.ts,*.tsx,*.js,*.jsx |
Select-String `
    -SimpleMatch `
    -Pattern $oldEmail

if ($remaining) {
    Write-Host ""
    Write-Host "ATTENTION : ancienne adresse encore presente :" -ForegroundColor Yellow
    $remaining
}
else {
    Write-Host "[OK] Ancienne adresse absente du code actif" -ForegroundColor Green
}

Write-Host ""
Write-Host "12.20 appliquee." -ForegroundColor Cyan