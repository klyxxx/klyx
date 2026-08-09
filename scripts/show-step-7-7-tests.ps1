$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$doc = Join-Path $root "docs\STEP-7-7-TESTS-COMME-DANS-KLYX.md"

if (-not (Test-Path -LiteralPath $doc)) {
  throw "Checklist introuvable : docs\STEP-7-7-TESTS-COMME-DANS-KLYX.md"
}

Write-Host ""
Write-Host "KLYX - TEST 7.7 GUIDE AVEC LES MOTS DE L'APPLICATION" -ForegroundColor Cyan
Write-Host ""
Write-Host "Ordre des boutons a tester :" -ForegroundColor White
Write-Host ""
Write-Host "PRESTATAIRE"
Write-Host "  1. Creer mon espace prestataire"
Write-Host "  2. Actualiser"
Write-Host "  3. Ouvrir mon activite"
Write-Host ""
Write-Host "CLIENT"
Write-Host "  4. Creer mon espace client"
Write-Host "  5. Recherche"
Write-Host ""
Write-Host "RESERVATION"
Write-Host "  6. Reservations & missions"
Write-Host "  7. Accepter"
Write-Host "  8. Payer la reservation"
Write-Host "  9. Suivre la prestation"
Write-Host ""
Write-Host "MISSION"
Write-Host " 10. Je suis en route"
Write-Host " 11. Je suis arrive"
Write-Host " 12. Commencer la prestation"
Write-Host " 13. Declarer la mission terminee"
Write-Host " 14. Confirmer la fin de mission"
Write-Host ""
Write-Host "Ouvre maintenant :" -ForegroundColor Green
Write-Host $doc
