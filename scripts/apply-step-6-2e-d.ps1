$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

$trust = Join-Path $root "app\trust\new\page.tsx"
$admin = Join-Path $root "app\admin\disputes\page.tsx"

foreach ($file in @($trust, $admin)) {
  if (-not (Test-Path -LiteralPath $file)) {
    throw "Fichier introuvable : $file"
  }

  $backup = "$file.step-6-2e-d.backup"

  if (-not (Test-Path -LiteralPath $backup)) {
    Copy-Item -LiteralPath $file -Destination $backup -Force
  }
}

function Ensure-Import {
  param(
    [string]$Content,
    [string]$Anchor,
    [string]$FileLabel
  )

  $importLine = 'import KlyxSelect from "@/app/components/KlyxSelect";'

  if ($Content.Contains($importLine)) {
    return $Content
  }

  if (-not $Content.Contains($Anchor)) {
    throw "Import de reference introuvable dans $FileLabel"
  }

  return $Content.Replace(
    $Anchor,
    $Anchor + "`r`n" + $importLine
  )
}

function Replace-Select {
  param(
    [string]$Content,
    [string]$ValueExpression,
    [string]$Replacement,
    [string]$Marker,
    [string]$FileLabel
  )

  if ($Content.Contains($Marker)) {
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

# ==========================================
# TRUST / NEW
# ==========================================

$content = Get-Content -LiteralPath $trust -Raw -Encoding UTF8

$content = Ensure-Import `
  -Content $content `
  -Anchor 'import { getActiveClientProfile } from "@/lib/account-switcher";' `
  -FileLabel "app/trust/new/page.tsx"

$bookingReplacement = @'
<KlyxSelect
                  value={bookingId}
                  onChange={setBookingId}
                  placeholder="Choisir une réservation"
                  options={bookings.map((booking) => ({
                    value: booking.id,
                    label: `${booking.booking_date} à ${booking.start_time.slice(0, 5)} · ${booking.status}`,
                  }))}
                  ariaLabel="Réservation concernée"
                />
'@

$content = Replace-Select `
  -Content $content `
  -ValueExpression 'bookingId' `
  -Replacement $bookingReplacement `
  -Marker 'ariaLabel="Réservation concernée"' `
  -FileLabel "app/trust/new/page.tsx"

$reasonReplacement = @'
<KlyxSelect
                  value={reason}
                  onChange={setReason}
                  placeholder="Choisir un motif"
                  options={REASONS.map(([value, label]) => ({
                    value,
                    label,
                  }))}
                  ariaLabel="Motif du signalement"
                />
'@

$content = Replace-Select `
  -Content $content `
  -ValueExpression 'reason' `
  -Replacement $reasonReplacement `
  -Marker 'ariaLabel="Motif du signalement"' `
  -FileLabel "app/trust/new/page.tsx"

Set-Content -LiteralPath $trust -Value $content -Encoding UTF8

# ==========================================
# ADMIN / DISPUTES
# ==========================================

$content = Get-Content -LiteralPath $admin -Raw -Encoding UTF8

$content = Ensure-Import `
  -Content $content `
  -Anchor '} from "lucide-react";' `
  -FileLabel "app/admin/disputes/page.tsx"

$statusFilterReplacement = @'
<KlyxSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "active", label: "Dossiers actifs" },
              { value: "all", label: "Tous les dossiers" },
              ...STATUSES.map(([value, label]) => ({
                value,
                label,
              })),
            ]}
            ariaLabel="Filtrer les dossiers"
          />
'@

$content = Replace-Select `
  -Content $content `
  -ValueExpression 'statusFilter' `
  -Replacement $statusFilterReplacement `
  -Marker 'ariaLabel="Filtrer les dossiers"' `
  -FileLabel "app/admin/disputes/page.tsx"

$formStatusReplacement = @'
<KlyxSelect
                        value={form.status}
                        onChange={(value) =>
                          setForms((current) => ({
                            ...current,
                            [row.id]: {
                              ...form,
                              status: value,
                            },
                          }))
                        }
                        options={STATUSES.map(([value, label]) => ({
                          value,
                          label,
                        }))}
                        ariaLabel="Statut du dossier"
                      />
'@

$content = Replace-Select `
  -Content $content `
  -ValueExpression 'form.status' `
  -Replacement $formStatusReplacement `
  -Marker 'ariaLabel="Statut du dossier"' `
  -FileLabel "app/admin/disputes/page.tsx"

$decisionReplacement = @'
<KlyxSelect
                        value={form.decisionCode}
                        onChange={(value) =>
                          setForms((current) => ({
                            ...current,
                            [row.id]: {
                              ...form,
                              decisionCode: value,
                            },
                          }))
                        }
                        options={DECISIONS.map(([value, label]) => ({
                          value,
                          label,
                        }))}
                        ariaLabel="Décision"
                      />
'@

$content = Replace-Select `
  -Content $content `
  -ValueExpression 'form.decisionCode' `
  -Replacement $decisionReplacement `
  -Marker 'ariaLabel="Décision"' `
  -FileLabel "app/admin/disputes/page.tsx"

Set-Content -LiteralPath $admin -Value $content -Encoding UTF8

Write-Host ""
Write-Host "Etape 6.2E-D appliquee avec succes." -ForegroundColor Green
Write-Host "Trust : Reservation concernee -> KlyxSelect"
Write-Host "Trust : Motif -> KlyxSelect"
Write-Host "Admin : Filtre dossiers -> KlyxSelect"
Write-Host "Admin : Statut dossier -> KlyxSelect"
Write-Host "Admin : Decision -> KlyxSelect"
Write-Host ""
Write-Host "Verification :"

$trustCount = @(Select-String -Path $trust -Pattern '<select' -SimpleMatch).Count
$adminCount = @(Select-String -Path $admin -Pattern '<select' -SimpleMatch).Count

Write-Host "Selects natifs restants dans trust/new : $trustCount"
Write-Host "Selects natifs restants dans admin/disputes : $adminCount"
Write-Host ""
Write-Host "Accounts n'est volontairement PAS modifie dans ce lot."
Write-Host "Execute maintenant : npm run build"
