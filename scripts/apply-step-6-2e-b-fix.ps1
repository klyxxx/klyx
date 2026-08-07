$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$memory = Join-Path $root "app\memory\page.tsx"
$settings = Join-Path $root "app\settings\page.tsx"

foreach ($file in @($memory, $settings)) {
  if (-not (Test-Path -LiteralPath $file)) {
    throw "Fichier introuvable : $file"
  }
}

# Sauvegarde seulement si elle n'existe pas déjà
if (-not (Test-Path -LiteralPath "$memory.step-6-2e-b-fix.backup")) {
  Copy-Item -LiteralPath $memory -Destination "$memory.step-6-2e-b-fix.backup" -Force
}

if (-not (Test-Path -LiteralPath "$settings.step-6-2e-b-fix.backup")) {
  Copy-Item -LiteralPath $settings -Destination "$settings.step-6-2e-b-fix.backup" -Force
}

# -------------------------
# MEMORY
# -------------------------

$memoryContent = Get-Content -LiteralPath $memory -Raw -Encoding UTF8

$memoryImport = 'import KlyxSelect from "@/app/components/KlyxSelect";'

if (-not $memoryContent.Contains($memoryImport)) {
  $memoryAnchor = 'import { supabase } from "@/lib/supabase";'

  if (-not $memoryContent.Contains($memoryAnchor)) {
    throw "Import Supabase introuvable dans app\memory\page.tsx"
  }

  $memoryContent = $memoryContent.Replace(
    $memoryAnchor,
    $memoryAnchor + "`r`n" + $memoryImport
  )
}

if (-not $memoryContent.Contains("<KlyxSelect") -or $memoryContent.Contains('value={householdType}')) {
  $memoryPattern = '(?s)<select\s+[^>]*value=\{householdType\}.*?</select>'

  $memoryReplacement = @'
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

  $nextMemory = [regex]::Replace(
    $memoryContent,
    $memoryPattern,
    $memoryReplacement,
    1
  )

  if ($nextMemory -eq $memoryContent) {
    if (-not $memoryContent.Contains('ariaLabel="Type de lieu"')) {
      throw "Impossible de trouver le select householdType dans memory."
    }
  } else {
    $memoryContent = $nextMemory
  }
}

Set-Content -LiteralPath $memory -Value $memoryContent -Encoding UTF8

# -------------------------
# SETTINGS
# -------------------------

$settingsContent = Get-Content -LiteralPath $settings -Raw -Encoding UTF8

$settingsImport = 'import KlyxSelect from "@/app/components/KlyxSelect";'

if (-not $settingsContent.Contains($settingsImport)) {
  $settingsAnchor = 'import { useTheme } from "@/app/components/ThemeProvider";'

  if (-not $settingsContent.Contains($settingsAnchor)) {
    throw "Import ThemeProvider introuvable dans app\settings\page.tsx"
  }

  $settingsContent = $settingsContent.Replace(
    $settingsAnchor,
    $settingsAnchor + "`r`n" + $settingsImport
  )
}

$settingsPattern = '(?s)<select\s+[^>]*value=\{language\}.*?</select>'

$settingsReplacement = @'
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

$nextSettings = [regex]::Replace(
  $settingsContent,
  $settingsPattern,
  $settingsReplacement,
  1
)

if ($nextSettings -eq $settingsContent) {
  if (-not $settingsContent.Contains('ariaLabel="Langue"')) {
    throw "Impossible de trouver le select language dans settings."
  }
} else {
  $settingsContent = $nextSettings
}

Set-Content -LiteralPath $settings -Value $settingsContent -Encoding UTF8

Write-Host ""
Write-Host "6.2E-B-FIX applique avec succes." -ForegroundColor Green
Write-Host "Memory : Type de lieu -> KlyxSelect"
Write-Host "Settings : Langue -> KlyxSelect"
Write-Host ""
Write-Host "Verification automatique :"

$remainingMemory = Select-String `
  -Path $memory `
  -Pattern '<select' `
  -SimpleMatch

$remainingSettings = Select-String `
  -Path $settings `
  -Pattern '<select' `
  -SimpleMatch

Write-Host "Selects natifs restants dans memory : $($remainingMemory.Count)"
Write-Host "Selects natifs restants dans settings : $($remainingSettings.Count)"
Write-Host ""
Write-Host "Execute maintenant : npm run build"
