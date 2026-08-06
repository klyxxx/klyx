$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$page = Join-Path $root "app\brain\page.tsx"

if (-not (Test-Path -LiteralPath $page)) {
  throw "Fichier introuvable : app\brain\page.tsx"
}

Copy-Item -LiteralPath $page -Destination "$page.step-4-2.backup" -Force

$content = Get-Content -LiteralPath $page -Raw

if (-not $content.Contains('import MemoryQuickStart from "./MemoryQuickStart";')) {
  $anchor = 'import SmartRecommendation from "./SmartRecommendation";'

  if (-not $content.Contains($anchor)) {
    throw "Import SmartRecommendation introuvable."
  }

  $content = $content.Replace(
    $anchor,
    $anchor + "`r`n" +
      'import MemoryQuickStart from "./MemoryQuickStart";'
  )
}

if ($content.Contains("<MemoryQuickStart")) {
  Write-Host "MemoryQuickStart existe déjà. Aucun doublon ajouté." -ForegroundColor Yellow
  Set-Content -LiteralPath $page -Value $content -Encoding utf8
  exit 0
}

$anchorBlock = @'
                {messages.length === 1 && (
                  <div className="grid gap-3 pt-2 sm:grid-cols-2">
'@

$replacement = @'
                {messages.length === 1 && (
                  <>
                    <MemoryQuickStart
                      disabled={loading}
                      onUseRequest={(message) =>
                        void sendMessage(undefined, message)
                      }
                    />

                    <div className="grid gap-3 pt-2 sm:grid-cols-2">
'@

if (-not $content.Contains($anchorBlock)) {
  throw "Bloc de suggestions introuvable."
}

$content = $content.Replace(
  $anchorBlock,
  $replacement
)

$closingAnchor = @'
                  </div>
                )}

                {loading && (
'@

$closingReplacement = @'
                    </div>
                  </>
                )}

                {loading && (
'@

if (-not $content.Contains($closingAnchor)) {
  throw "Fermeture du bloc de suggestions introuvable."
}

$content = $content.Replace(
  $closingAnchor,
  $closingReplacement
)

Set-Content -LiteralPath $page -Value $content -Encoding utf8

Write-Host ""
Write-Host "Étape 4.2 appliquée avec succès." -ForegroundColor Green
Write-Host "Aucun fichier prestataire n’a été modifié."
Write-Host "Sauvegarde : app\brain\page.tsx.step-4-2.backup"
Write-Host "Exécute maintenant : npm run build"
