$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$accounts = Join-Path $root "app\accounts\page.tsx"
$componentSource = Join-Path $PSScriptRoot "..\app\components\KlyxSelect.tsx"
$componentTarget = Join-Path $root "app\components\KlyxSelect.tsx"

foreach ($file in @($accounts, $componentSource, $componentTarget)) {
  if (-not (Test-Path -LiteralPath $file)) {
    throw "Fichier introuvable : $file"
  }
}

foreach ($file in @($accounts, $componentTarget)) {
  $backup = "$file.step-6-2e-e.backup"
  if (-not (Test-Path -LiteralPath $backup)) {
    Copy-Item -LiteralPath $file -Destination $backup -Force
  }
}

# 1. Upgrade KlyxSelect with required/name support.
Copy-Item -LiteralPath $componentSource -Destination $componentTarget -Force

# 2. Convert Accounts > Premier service.
$content = Get-Content -LiteralPath $accounts -Raw -Encoding UTF8

$importLine = 'import KlyxSelect from "@/app/components/KlyxSelect";'
$anchor = 'import { supabase } from "@/lib/supabase";'

if (-not $content.Contains($importLine)) {
  if (-not $content.Contains($anchor)) {
    throw "Import Supabase introuvable dans app\accounts\page.tsx"
  }

  $content = $content.Replace(
    $anchor,
    $anchor + "`r`n" + $importLine
  )
}

if (-not $content.Contains('ariaLabel="Premier service"')) {
  $pattern = '(?s)<select\s+[^>]*value=\{form\.serviceId\}.*?</select>'

  $replacement = @'
<KlyxSelect
                    value={form.serviceId}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        serviceId: value,
                      }))
                    }
                    placeholder="Choisir un service"
                    required
                    options={services.map((service) => ({
                      value: service.id,
                      label: service.name,
                    }))}
                    ariaLabel="Premier service"
                  />
'@

  $next = [regex]::Replace(
    $content,
    $pattern,
    $replacement,
    1
  )

  if ($next -eq $content) {
    throw "Select form.serviceId introuvable dans accounts."
  }

  $content = $next
}

Set-Content -LiteralPath $accounts -Value $content -Encoding UTF8

Write-Host ""
Write-Host "Etape 6.2E-E appliquee avec succes." -ForegroundColor Green
Write-Host "KlyxSelect : support required ajoute"
Write-Host "KlyxSelect : support name ajoute"
Write-Host "Accounts : Premier service -> KlyxSelect"
Write-Host ""
Write-Host "Verification du select natif Accounts :"

$accountsCount = @(Select-String -Path $accounts -Pattern '<select' -SimpleMatch).Count
Write-Host "Selects natifs restants dans accounts : $accountsCount"

Write-Host ""
Write-Host "Verification globale des selects natifs dans app :"
$remaining = Get-ChildItem -Path (Join-Path $root "app") -Recurse -Include *.tsx |
  Select-String -Pattern '<select' -SimpleMatch |
  Select-Object Path, LineNumber, Line

if (@($remaining).Count -eq 0) {
  Write-Host "Aucun <select> natif restant dans app." -ForegroundColor Green
} else {
  $remaining | Format-Table -AutoSize
}

Write-Host ""
Write-Host "Aucun SQL, Stripe ou account-switcher modifie."
Write-Host "Execute maintenant : npm run build"
