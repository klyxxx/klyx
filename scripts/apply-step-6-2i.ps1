$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$client = Join-Path $root "app\dashboard\ClientDashboard.tsx"
$provider = Join-Path $root "app\dashboard\ProviderDashboard.tsx"
$component = Join-Path $root "app\components\DashboardActionCenter.tsx"

foreach ($file in @($client, $provider, $component)) {
  if (-not (Test-Path -LiteralPath $file)) {
    throw "Fichier introuvable : $file"
  }
}

foreach ($file in @($client, $provider)) {
  $backup = "$file.step-6-2i.backup"

  if (-not (Test-Path -LiteralPath $backup)) {
    Copy-Item `
      -LiteralPath $file `
      -Destination $backup `
      -Force
  }
}

function Add-ActionCenter {
  param(
    [string]$Path,
    [string]$AccountType
  )

  $content = Get-Content `
    -LiteralPath $Path `
    -Raw `
    -Encoding UTF8

  $importLine = 'import DashboardActionCenter from "@/app/components/DashboardActionCenter";'
  $importAnchor = 'import Link from "next/link";'

  if (-not $content.Contains($importLine)) {
    if (-not $content.Contains($importAnchor)) {
      throw "Import Link introuvable : $Path"
    }

    $content = $content.Replace(
      $importAnchor,
      $importAnchor + "`r`n" + $importLine
    )
  }

  $marker = "<DashboardActionCenter accountType=`"$AccountType`" />"

  if (-not $content.Contains($marker)) {
    $pattern = '(?s)(</section>\s*)(<section className="mt-8">)'
    $replacement = '$1' + "`r`n      " + $marker + "`r`n`r`n      " + '$2'

    $next = [regex]::Replace(
      $content,
      $pattern,
      $replacement,
      1
    )

    if ($next -eq $content) {
      throw "Point d'insertion introuvable : $Path"
    }

    $content = $next
  }

  Set-Content `
    -LiteralPath $Path `
    -Value $content `
    -Encoding UTF8
}

Add-ActionCenter `
  -Path $client `
  -AccountType "client"

Add-ActionCenter `
  -Path $provider `
  -AccountType "provider"

Write-Host ""
Write-Host "Etape 6.2I appliquee avec succes." -ForegroundColor Green
Write-Host "Client : centre d'actions devis ajoute."
Write-Host "Prestataire : centre d'actions devis ajoute."
Write-Host "Chargement asynchrone : le dashboard n'attend pas les devis."
Write-Host "Aucun SQL, Stripe, schema Supabase ou account-switcher modifie."
Write-Host ""
Write-Host "Execute maintenant : npm run build"
