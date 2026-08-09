$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$memory = Join-Path $root "app\memory\page.tsx"
$settings = Join-Path $root "app\settings\page.tsx"

foreach ($file in @($memory, $settings)) {
  if (-not (Test-Path -LiteralPath $file)) {
    throw "Fichier introuvable : $file"
  }
  Copy-Item -LiteralPath $file -Destination "$file.step-6-2e-b.backup" -Force
}

# MEMORY
$content = Get-Content -LiteralPath $memory -Raw -Encoding UTF8

$importAnchor = 'import { supabase } from "@/lib/supabase";'
$importLine = 'import KlyxSelect from "@/app/components/KlyxSelect";'

if (-not $content.Contains($importLine)) {
  if (-not $content.Contains($importAnchor)) {
    throw "Import Supabase introuvable dans memory."
  }
  $content = $content.Replace(
    $importAnchor,
    $importAnchor + "`r`n" + $importLine
  )
}

$old = @'
                <select
                  value={householdType}
                  onChange={(event) =>
                    setHouseholdType(event.target.value)
                  }
                  className="klyx-input"
                >
                  <option value="">Non renseigné</option>
                  <option value="apartment">
                    Appartement
                  </option>
                  <option value="house">Maison</option>
                  <option value="studio">Studio</option>
                  <option value="office">Bureau</option>
                  <option value="other">Autre</option>
                </select>
'@

$new = @'
                <KlyxSelect
                  value={householdType}
                  onChange={setHouseholdType}
                  options={[
                    { value: "", label: "Non renseigné" },
                    { value: "apartment", label: "Appartement" },
                    { value: "house", label: "Maison" },
                    { value: "studio", label: "Studio" },
                    { value: "office", label: "Bureau" },
                    { value: "other", label: "Autre" },
                  ]}
                  ariaLabel="Type de lieu"
                />
'@

if (-not $content.Contains($old)) {
  throw "Select Type de lieu introuvable dans memory."
}
$content = $content.Replace($old, $new)
Set-Content -LiteralPath $memory -Value $content -Encoding UTF8

# SETTINGS
$content = Get-Content -LiteralPath $settings -Raw -Encoding UTF8

$importAnchor = 'import { useTheme } from "@/app/components/ThemeProvider";'
$importLine = 'import KlyxSelect from "@/app/components/KlyxSelect";'

if (-not $content.Contains($importLine)) {
  if (-not $content.Contains($importAnchor)) {
    throw "Import ThemeProvider introuvable dans settings."
  }
  $content = $content.Replace(
    $importAnchor,
    $importAnchor + "`r`n" + $importLine
  )
}

$old = @'
            <select
              value={language}
              onChange={(event) => {
                setLanguage(event.target.value);
                localStorage.setItem(LANGUAGE_KEY, event.target.value);
              }}
              className="klyx-input"
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
              <option value="nl">Nederlands</option>
            </select>
'@

$new = @'
            <KlyxSelect
              value={language}
              onChange={(value) => {
                setLanguage(value);
                localStorage.setItem(LANGUAGE_KEY, value);
              }}
              options={[
                { value: "fr", label: "Français" },
                { value: "en", label: "English" },
                { value: "nl", label: "Nederlands" },
              ]}
              ariaLabel="Langue"
            />
'@

if (-not $content.Contains($old)) {
  throw "Select Langue introuvable dans settings."
}
$content = $content.Replace($old, $new)
Set-Content -LiteralPath $settings -Value $content -Encoding UTF8

Write-Host ""
Write-Host "Etape 6.2E-B appliquee avec succes." -ForegroundColor Green
Write-Host "Memory : Type de lieu converti en KlyxSelect."
Write-Host "Settings : Langue convertie en KlyxSelect."
Write-Host "Execute maintenant : npm run build"
