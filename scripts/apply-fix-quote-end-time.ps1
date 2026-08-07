$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$file = Join-Path $root "app\quotes\[id]\book\page.tsx"

if (-not (Test-Path -LiteralPath $file)) {
  throw "Fichier introuvable : app\quotes\[id]\book\page.tsx"
}

$backup = "$file.fix-end-time.backup"
if (-not (Test-Path -LiteralPath $backup)) {
  Copy-Item -LiteralPath $file -Destination $backup -Force
}

$content = Get-Content -LiteralPath $file -Raw -Encoding UTF8

$old = @'
              <input
                type="time"
                required
                readOnly
                value={endTime}
                className="klyx-input cursor-not-allowed opacity-80"
              />
'@

$new = @'
              <input
                type="time"
                required
                value={endTime}
                onChange={(event) =>
                  setEndTime(event.target.value)
                }
                className="klyx-input"
              />
'@

if ($content.Contains($old)) {
  $content = $content.Replace($old, $new)
}
elseif ($content.Contains('onChange={(event) =>') -and $content.Contains('setEndTime(event.target.value)')) {
  Write-Host "[OK] Le champ Fin est deja modifiable." -ForegroundColor Yellow
}
else {
  throw "Bloc du champ Fin introuvable."
}

Set-Content -LiteralPath $file -Value $content -Encoding UTF8

Write-Host ""
Write-Host "CORRECTIF DEVIS APPLIQUE." -ForegroundColor Green
Write-Host "Le champ Fin est maintenant modifiable."
Write-Host "L'heure reste pre-remplie automatiquement depuis la duree du devis."
Write-Host "La validation des disponibilites reste active."
Write-Host ""
Write-Host "Execute maintenant : npm run build"
