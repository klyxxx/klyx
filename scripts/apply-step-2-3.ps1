$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$brainPage = Join-Path $root "app\brain\page.tsx"

if (-not (Test-Path -LiteralPath $brainPage)) {
  throw "Fichier introuvable : app\brain\page.tsx"
}

Copy-Item -LiteralPath $brainPage -Destination "$brainPage.step-2-3.backup" -Force

$content = Get-Content -LiteralPath $brainPage -Raw

$importAnchor = 'import { supabase } from "@/lib/supabase";'
$importLine = @'
import { supabase } from "@/lib/supabase";
import SmartRecommendation from "./SmartRecommendation";
'@

if (-not $content.Contains($importAnchor)) {
  throw "Import Supabase introuvable. Aucun changement appliqué."
}

if (-not $content.Contains('SmartRecommendation from "./SmartRecommendation"')) {
  $content = $content.Replace($importAnchor, $importLine)
}

$oldBlock = @'
              {payload?.ready && (
                <div className="border-t border-border bg-violet-500/[0.04] p-5">
                  <button
                    type="button"
                    onClick={openResults}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-4 text-sm font-bold text-white shadow-[0_12px_30px_rgba(124,58,237,0.28)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgba(124,58,237,0.36)]"
                  >
                    Voir les meilleurs prestataires
                    <ArrowRight size={18} />
                  </button>
                </div>
              )}
'@

$newBlock = @'
              {payload?.ready && (
                <>
                  <SmartRecommendation payload={payload} />

                  <div className="border-t border-border bg-violet-500/[0.04] p-5 pt-0">
                    <button
                      type="button"
                      onClick={openResults}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-violet-500/25 bg-background px-6 py-3.5 text-sm font-bold text-violet-700 transition hover:bg-violet-500/10 dark:text-violet-300"
                    >
                      Comparer tous les prestataires
                      <ArrowRight size={18} />
                    </button>
                  </div>
                </>
              )}
'@

if (-not $content.Contains($oldBlock)) {
  throw "Bloc de résultats attendu introuvable. Aucun changement appliqué."
}

$content = $content.Replace($oldBlock, $newBlock)
Set-Content -LiteralPath $brainPage -Value $content -Encoding utf8

Write-Host ""
Write-Host "Étape 2.3 appliquée avec succès." -ForegroundColor Green
Write-Host "Sauvegarde créée : app\brain\page.tsx.step-2-3.backup"
Write-Host "Exécute maintenant : npm run build"
