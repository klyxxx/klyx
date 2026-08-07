$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

$studio = Join-Path $root "app\components\ProviderStudio.tsx"
$serviceNew = Join-Path $root "app\provider\services\new\page.tsx"
$zones = Join-Path $root "app\provider\zones\page.tsx"

foreach ($file in @($studio, $serviceNew, $zones)) {
  if (-not (Test-Path -LiteralPath $file)) {
    throw "Fichier introuvable : $file"
  }

  $backup = "$file.step-6-2e-c.backup"

  if (-not (Test-Path -LiteralPath $backup)) {
    Copy-Item -LiteralPath $file -Destination $backup -Force
  }
}

function Ensure-Import {
  param(
    [string]$Content,
    [string]$ImportLine,
    [string]$Anchor,
    [string]$FileLabel
  )

  if ($Content.Contains($ImportLine)) {
    return $Content
  }

  if (-not $Content.Contains($Anchor)) {
    throw "Import de reference introuvable dans $FileLabel"
  }

  return $Content.Replace(
    $Anchor,
    $Anchor + "`r`n" + $ImportLine
  )
}

function Replace-SelectByValue {
  param(
    [string]$Content,
    [string]$ValueExpression,
    [string]$Replacement,
    [string]$AlreadyMarker,
    [string]$FileLabel
  )

  if ($Content.Contains($AlreadyMarker)) {
    return $Content
  }

  $escaped = [regex]::Escape($ValueExpression)
  $pattern = "(?s)<select\s+[^>]*value=\{$escaped\}.*?</select>"

  $next = [regex]::Replace(
    $Content,
    $pattern,
    $Replacement,
    1
  )

  if ($next -eq $Content) {
    throw "Select $ValueExpression introuvable dans $FileLabel"
  }

  return $next
}

# -------------------------------------------------
# ProviderStudio
# -------------------------------------------------

$content = Get-Content -LiteralPath $studio -Raw -Encoding UTF8

$content = Ensure-Import `
  -Content $content `
  -ImportLine 'import KlyxSelect from "@/app/components/KlyxSelect";' `
  -Anchor '} from "@/lib/provider-studio";' `
  -FileLabel "ProviderStudio.tsx"

$replacement = @'
<KlyxSelect
                  value={documentType}
                  onChange={setDocumentType}
                  options={DOCUMENT_TYPES.map((type) => ({
                    value: type.value,
                    label: type.label,
                  }))}
                  ariaLabel="Type de document"
                />
'@

$content = Replace-SelectByValue `
  -Content $content `
  -ValueExpression 'documentType' `
  -Replacement $replacement `
  -AlreadyMarker 'ariaLabel="Type de document"' `
  -FileLabel "ProviderStudio.tsx"

Set-Content -LiteralPath $studio -Value $content -Encoding UTF8

# -------------------------------------------------
# provider/services/new
# -------------------------------------------------

$content = Get-Content -LiteralPath $serviceNew -Raw -Encoding UTF8

$content = Ensure-Import `
  -Content $content `
  -ImportLine 'import KlyxSelect from "@/app/components/KlyxSelect";' `
  -Anchor '} from "lucide-react";' `
  -FileLabel "provider/services/new/page.tsx"

$replacement = @'
<KlyxSelect
                value={category}
                onChange={setCategory}
                options={categories.map((item) => ({
                  value: item,
                  label: item,
                }))}
                ariaLabel="Catégorie"
              />
'@

$content = Replace-SelectByValue `
  -Content $content `
  -ValueExpression 'category' `
  -Replacement $replacement `
  -AlreadyMarker 'ariaLabel="Catégorie"' `
  -FileLabel "provider/services/new/page.tsx"

Set-Content -LiteralPath $serviceNew -Value $content -Encoding UTF8

# -------------------------------------------------
# provider/zones
# -------------------------------------------------

$content = Get-Content -LiteralPath $zones -Raw -Encoding UTF8

$content = Ensure-Import `
  -Content $content `
  -ImportLine 'import KlyxSelect from "@/app/components/KlyxSelect";' `
  -Anchor 'import { BELGIAN_LOCALITIES } from "@/lib/belgian-localities";' `
  -FileLabel "provider/zones/page.tsx"

$replacement = @'
<KlyxSelect
                    value={userServiceId}
                    onChange={setUserServiceId}
                    options={services.map((service) => ({
                      value: service.id,
                      label: serviceLabel(service),
                    }))}
                    ariaLabel="Métier"
                  />
'@

$content = Replace-SelectByValue `
  -Content $content `
  -ValueExpression 'userServiceId' `
  -Replacement $replacement `
  -AlreadyMarker 'ariaLabel="Métier"' `
  -FileLabel "provider/zones/page.tsx"

$replacement = @'
<KlyxSelect
                    value={locality}
                    onChange={setLocality}
                    placeholder="Choisir une commune"
                    options={BELGIAN_LOCALITIES.map((item) => ({
                      value: item.name,
                      label: `${item.name} · ${item.postalCodes.join(", ")} · ${item.region}`,
                    }))}
                    ariaLabel="Commune principale"
                  />
'@

$content = Replace-SelectByValue `
  -Content $content `
  -ValueExpression 'locality' `
  -Replacement $replacement `
  -AlreadyMarker 'ariaLabel="Commune principale"' `
  -FileLabel "provider/zones/page.tsx"

Set-Content -LiteralPath $zones -Value $content -Encoding UTF8

Write-Host ""
Write-Host "Etape 6.2E-C appliquee avec succes." -ForegroundColor Green
Write-Host "ProviderStudio : Type de document -> KlyxSelect"
Write-Host "Ajouter un metier : Categorie -> KlyxSelect"
Write-Host "Zones : Metier -> KlyxSelect"
Write-Host "Zones : Commune principale -> KlyxSelect"
Write-Host ""
Write-Host "Verification des selects natifs restants :"

$studioCount = @(Select-String -Path $studio -Pattern '<select' -SimpleMatch).Count
$serviceCount = @(Select-String -Path $serviceNew -Pattern '<select' -SimpleMatch).Count
$zonesCount = @(Select-String -Path $zones -Pattern '<select' -SimpleMatch).Count

Write-Host "ProviderStudio : $studioCount"
Write-Host "provider/services/new : $serviceCount"
Write-Host "provider/zones : $zonesCount"
Write-Host ""
Write-Host "Aucun changement Supabase, Stripe, reservations ou comptes."
Write-Host "Execute maintenant : npm run build"
