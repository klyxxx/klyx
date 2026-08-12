$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.42 - ASSISTANT PREFILL" -ForegroundColor Cyan
Write-Host ""

$path = "app\assistant\market\page.tsx"

if (-not (Test-Path -LiteralPath $path)) {
  throw "Fichier manquant : $path"
}

$content = Get-Content -LiteralPath $path -Raw

# 12.41 transmet ?request=...
# 12.42 garantit que /assistant/market récupère cette demande.
if ($content -notmatch 'useSearchParams') {
  $nextImportPattern = '(import\s+\{)([^}]*)(\}\s+from\s+"next/navigation";)'

  if ($content -match $nextImportPattern) {
    $content = [regex]::Replace(
      $content,
      $nextImportPattern,
      {
        param($m)
        $items = $m.Groups[2].Value.Trim()
        if ($items) {
          return $m.Groups[1].Value + " " + $items + ", useSearchParams " + $m.Groups[3].Value
        }
        return $m.Groups[1].Value + " useSearchParams " + $m.Groups[3].Value
      },
      1
    )
  } else {
    $content = 'import { useSearchParams } from "next/navigation";' + "`r`n" + $content
  }
}

# Détecte le setter du champ principal.
$setterMatch = [regex]::Match(
  $content,
  'const\s+\[\s*([A-Za-z0-9_]+)\s*,\s*(set[A-Za-z0-9_]+)\s*\]\s*=\s*useState(?:<[^;]+?>)?\(\s*""\s*\)'
)

if (-not $setterMatch.Success) {
  throw "Champ texte principal de l'assistant introuvable."
}

$setter = $setterMatch.Groups[2].Value

if ($content -notmatch 'searchParams\.get\("request"\)') {
  $componentMatch = [regex]::Match(
    $content,
    'export\s+default\s+function\s+[A-Za-z0-9_]+\s*\([^)]*\)\s*\{'
  )

  if (-not $componentMatch.Success) {
    throw "Composant /assistant/market introuvable."
  }

  $insertAt = $componentMatch.Index + $componentMatch.Length
  $hook = @"

  const searchParams = useSearchParams();
  const initialRequest = searchParams.get("request")?.trim() ?? "";
"@

  $content = $content.Insert($insertAt, $hook)

  # Ajoute l'effet après les déclarations d'état, avant la première fonction interne.
  $functionIndex = $content.IndexOf("  async function ", $insertAt)
  if ($functionIndex -lt 0) {
    $functionIndex = $content.IndexOf("  function ", $insertAt)
  }

  if ($functionIndex -lt 0) {
    throw "Point d'insertion de l'effet introuvable."
  }

  $effect = @"
  useEffect(() => {
    if (!initialRequest) return;
    $setter((current) => current.trim() ? current : initialRequest);
  }, [initialRequest]);

"@

  $content = $content.Insert($functionIndex, $effect)
}

# useEffect doit être importé depuis React.
if ($content -notmatch 'import\s+\{[^}]*useEffect[^}]*\}\s+from\s+"react"') {
  $reactPattern = '(import\s+\{)([^}]*)(\}\s+from\s+"react";)'
  if ($content -match $reactPattern) {
    $content = [regex]::Replace(
      $content,
      $reactPattern,
      {
        param($m)
        $items = $m.Groups[2].Value.Trim()
        return $m.Groups[1].Value + " " + $items + ", useEffect " + $m.Groups[3].Value
      },
      1
    )
  } else {
    throw "Import React nomme introuvable."
  }
}

[IO.File]::WriteAllText(
  (Resolve-Path -LiteralPath $path),
  $content,
  [Text.UTF8Encoding]::new($false)
)

Write-Host "[OK] Parametre request lu" -ForegroundColor Green
Write-Host "[OK] Demande 12.41 pre-remplie" -ForegroundColor Green
Write-Host "[OK] Saisie utilisateur existante protegee" -ForegroundColor Green
Write-Host ""
Write-Host "12.42 appliquee. Aucune migration SQL." -ForegroundColor Cyan
