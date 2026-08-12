$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$payload = Join-Path $root "payload"
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.41 - ASSISTANT COMMAND BAR" -ForegroundColor Cyan
Write-Host ""

$source = Join-Path $payload "app\components\AssistantCommandBar.tsx"
$target = Join-Path $root "app\components\AssistantCommandBar.tsx"

if (-not (Test-Path -LiteralPath $source)) {
  throw "Payload AssistantCommandBar manquant."
}

New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
Copy-Item -LiteralPath $source -Destination $target -Force
Write-Host "[OK] AssistantCommandBar installe" -ForegroundColor Green

$pagePath = "app\assistant\page.tsx"
if (-not (Test-Path -LiteralPath $pagePath)) {
  throw "Fichier manquant : $pagePath"
}

$page = Get-Content -LiteralPath $pagePath -Raw

$import = 'import AssistantCommandBar from "@/app/components/AssistantCommandBar";'

if (-not $page.Contains($import)) {
  $importAnchor = 'import AssistantBrief from "@/app/components/AssistantBrief";'

  if ($page.Contains($importAnchor)) {
    $page = $page.Replace(
      $importAnchor,
      "$importAnchor`r`n$import"
    )
  } else {
    $firstImport = [regex]::Match($page, '(?m)^import .+;$')
    if (-not $firstImport.Success) {
      throw "Import d'ancrage introuvable dans /assistant."
    }

    $insertAt = $firstImport.Index + $firstImport.Length
    $page = $page.Insert($insertAt, "`r`n$import")
  }
}

if ($page -notmatch '<AssistantCommandBar') {
  $anchor = '<AssistantBrief />'

  if (-not $page.Contains($anchor)) {
    throw "AssistantBrief introuvable dans /assistant."
  }

  $page = $page.Replace(
    $anchor,
    "$anchor`r`n`r`n          <AssistantCommandBar />"
  )
}

[IO.File]::WriteAllText(
  (Resolve-Path -LiteralPath $pagePath),
  $page,
  [Text.UTF8Encoding]::new($false)
)

Write-Host "[OK] Command bar ajoutee a /assistant" -ForegroundColor Green
Write-Host "[OK] Texte libre -> marche KLYX" -ForegroundColor Green
Write-Host "[OK] Recherche par photo conservee" -ForegroundColor Green
Write-Host "[OK] Exemples rapides ajoutes" -ForegroundColor Green
Write-Host ""
Write-Host "12.41 appliquee. Aucune migration SQL." -ForegroundColor Cyan
