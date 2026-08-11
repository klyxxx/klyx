$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.21 - NOTIFICATION SWITCHES" -ForegroundColor Cyan
Write-Host ""

$path = "app\\settings\\page.tsx"

if (-not (Test-Path -LiteralPath $path)) {
  throw "Fichier introuvable : $path"
}

$content = Get-Content -LiteralPath $path -Raw

$old = @'
          <Section icon={<Bell />} title="Notifications">
            {(
              [
                ["bookings", "Réservations"],
                ["messages", "Messages"],
                ["promotions", "Nouveautés"],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className="mb-3 flex items-center justify-between rounded-2xl border border-border p-4"
              >
                <span className="font-bold">{label}</span>
                <input
                  type="checkbox"
                  checked={notifications[key]}
                  onChange={(event) =>
                    updateNotifications(key, event.target.checked)
                  }
                />
              </label>
            ))}
          </Section>
'@

$new = @'
          <Section icon={<Bell />} title="Notifications">
            <div className="space-y-3">
              {(
                [
                  [
                    "bookings",
                    "Réservations",
                    "Confirmations, changements de statut et rappels de mission.",
                  ],
                  [
                    "messages",
                    "Messages",
                    "Nouveaux messages liés à tes demandes et missions.",
                  ],
                  [
                    "promotions",
                    "Nouveautés",
                    "Nouvelles fonctions et informations importantes de KLYX.",
                  ],
                ] as const
              ).map(([key, label, description]) => {
                const enabled = notifications[key];

                return (
                  <div
                    key={key}
                    className="flex min-w-0 items-center justify-between gap-5 rounded-2xl border border-border bg-background/50 p-4 sm:p-5"
                  >
                    <div className="min-w-0">
                      <p className="font-black text-foreground">{label}</p>
                      <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                        {description}
                      </p>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      aria-label={`${label} : ${enabled ? "activé" : "désactivé"}`}
                      onClick={() => updateNotifications(key, !enabled)}
                      className={`relative h-8 w-14 shrink-0 rounded-full border transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-500/20 ${
                        enabled
                          ? "border-violet-500 bg-violet-600"
                          : "border-border bg-muted dark:bg-white/10"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${
                          enabled ? "translate-x-7" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </Section>
'@

if ($content.Contains($new)) {
  Write-Host "[OK] Notification switches deja installes." -ForegroundColor Green
  exit 0
}

if (-not $content.Contains($old)) {
  throw "Bloc Notifications attendu introuvable. Aucun remplacement force."
}

$content = $content.Replace($old, $new)

[System.IO.File]::WriteAllText(
  (Resolve-Path -LiteralPath $path),
  $content,
  [System.Text.UTF8Encoding]::new($false)
)

Write-Host "[OK] Checkboxes natives remplacees" -ForegroundColor Green
Write-Host "[OK] Switches accessibles role=switch" -ForegroundColor Green
Write-Host "[OK] Descriptions ajoutees" -ForegroundColor Green
Write-Host ""
Write-Host "12.21 appliquee." -ForegroundColor Cyan
