$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$targetPath = Join-Path $projectRoot "app\components\BrainReadinessCard.tsx"

Write-Host ""
Write-Host "KLYX 12.62c - Repair BrainReadinessCard"
Write-Host ""

if (-not (Test-Path -LiteralPath $targetPath)) {
    throw "BrainReadinessCard.tsx introuvable."
}

$oldContent = [System.IO.File]::ReadAllText($targetPath)

if (-not $oldContent.Contains("KLYX_READINESS_CARD_12_62")) {
    throw "Le composant KLYX 12.62 attendu est introuvable."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = "$targetPath.bak-12-62c-$timestamp"

Copy-Item `
    -LiteralPath $targetPath `
    -Destination $backupPath `
    -Force

Write-Host "Sauvegarde : $backupPath"

$newLine = "`r`n"

$lines = @(
    '"use client";'
    ''
    'import { CheckCircle2, CircleAlert, Pencil } from "lucide-react";'
    ''
    '// KLYX_READINESS_CARD_12_62'
    '// KLYX_READINESS_CARD_REPAIR_12_62C'
    'export type BrainReadinessViewModel = {'
    '  score: number;'
    '  label: string;'
    '  isComplete: boolean;'
    '  remainingCount: number;'
    '  missing: string[];'
    '  nextMissing: string | null;'
    '  requiresConfirmation: boolean;'
    '  confirmationState:'
    '    | "awaiting_user_confirmation"'
    '    | "not_ready";'
    '  confirmationOptions?: Array<{'
    '    id: string;'
    '    action: string;'
    '    label: string;'
    '  }>;'
    '  summary: {'
    '    service: string;'
    '    city: string;'
    '    date: string;'
    '    time: string;'
    '  } | null;'
    '  automaticExecutionAllowed: boolean;'
    '};'
    ''
    'type Props = {'
    '  readiness: BrainReadinessViewModel;'
    '  onConfirm?: () => void;'
    '  onEdit?: () => void;'
    '};'
    ''
    'const fieldLabels: Record<string, string> = {'
    '  service: "service",'
    '  ville: "ville",'
    '  date: "date",'
    '  heure: "heure",'
    '};'
    ''
    'export default function BrainReadinessCard({'
    '  readiness,'
    '  onConfirm,'
    '  onEdit,'
    '}: Props) {'
    '  const safeScore = Math.max('
    '    0,'
    '    Math.min(100, readiness.score)'
    '  );'
    ''
    '  return ('
    '    <section className="rounded-[1.6rem] border border-border bg-card p-5 shadow-sm">'
    '      <div className="flex items-start justify-between gap-4">'
    '        <div>'
    '          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">'
    '            Préparation de la demande'
    '          </p>'
    '          <h3 className="mt-1 text-base font-black text-foreground">'
    '            {readiness.label}'
    '          </h3>'
    '        </div>'
    ''
    '        <div className="rounded-full border border-border bg-background px-3 py-1 text-sm font-black">'
    '          {safeScore} %'
    '        </div>'
    '      </div>'
    ''
    '      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">'
    '        <div'
    '          className="h-full rounded-full bg-violet-600 transition-all duration-500"'
    '          style={{ width: String(safeScore) + "%" }}'
    '        />'
    '      </div>'
    ''
    '      {!readiness.isComplete && ('
    '        <div className="mt-4 flex gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">'
    '          <CircleAlert'
    '            className="mt-0.5 shrink-0 text-amber-600"'
    '            size={18}'
    '          />'
    ''
    '          <div className="text-sm">'
    '            <p className="font-bold">'
    '              {readiness.remainingCount} information'
    '              {readiness.remainingCount > 1 ? "s" : ""} restante'
    '              {readiness.remainingCount > 1 ? "s" : ""}'
    '            </p>'
    ''
    '            <p className="mt-1 text-muted-foreground">'
    '              {readiness.missing'
    '                .map('
    '                  (field) => fieldLabels[field] ?? field'
    '                )'
    '                .join(" • ")}'
    '            </p>'
    '          </div>'
    '        </div>'
    '      )}'
    ''
    '      {readiness.isComplete && readiness.summary && ('
    '        <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">'
    '          <div className="flex items-center gap-2 font-black text-emerald-700 dark:text-emerald-300">'
    '            <CheckCircle2 size={18} />'
    '            Demande complète'
    '          </div>'
    ''
    '          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">'
    '            <div>'
    '              <dt className="text-muted-foreground">'
    '                Service'
    '              </dt>'
    '              <dd className="font-bold">'
    '                {readiness.summary.service}'
    '              </dd>'
    '            </div>'
    ''
    '            <div>'
    '              <dt className="text-muted-foreground">'
    '                Ville'
    '              </dt>'
    '              <dd className="font-bold">'
    '                {readiness.summary.city}'
    '              </dd>'
    '            </div>'
    ''
    '            <div>'
    '              <dt className="text-muted-foreground">'
    '                Date'
    '              </dt>'
    '              <dd className="font-bold">'
    '                {readiness.summary.date}'
    '              </dd>'
    '            </div>'
    ''
    '            <div>'
    '              <dt className="text-muted-foreground">'
    '                Heure'
    '              </dt>'
    '              <dd className="font-bold">'
    '                {readiness.summary.time}'
    '              </dd>'
    '            </div>'
    '          </dl>'
    ''
    '          {readiness.requiresConfirmation && ('
    '            <p className="mt-4 text-xs font-semibold text-muted-foreground">'
    '              KLYX attend ta confirmation avant toute action.'
    '            </p>'
    '          )}'
    ''
    '          <div className="mt-4 grid gap-2 sm:grid-cols-2">'
    '            <button'
    '              type="button"'
    '              onClick={onEdit}'
    '              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm font-bold transition hover:bg-muted"'
    '            >'
    '              <Pencil size={16} />'
    '              Modifier'
    '            </button>'
    ''
    '            <button'
    '              type="button"'
    '              onClick={onConfirm}'
    '              className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-violet-700"'
    '            >'
    '              <CheckCircle2 size={16} />'
    '              Confirmer'
    '            </button>'
    '          </div>'
    '        </div>'
    '      )}'
    '    </section>'
    '  );'
    '}'
)

$newContent = [string]::Join(
    $newLine,
    $lines
)

$checks = @(
    "KLYX_READINESS_CARD_12_62",
    "KLYX_READINESS_CARD_REPAIR_12_62C",
    'style={{ width: String(safeScore) + "%" }}',
    "readiness.summary.service",
    "readiness.summary.city",
    "readiness.summary.date",
    "readiness.summary.time",
    "KLYX attend ta confirmation avant toute action.",
    "onClick={onEdit}",
    "onClick={onConfirm}"
)

foreach ($check in $checks) {
    if (-not $newContent.Contains($check)) {
        throw "Verification avant ecriture echouee : $check"
    }
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

try {
    [System.IO.File]::WriteAllText(
        $targetPath,
        $newContent,
        $utf8NoBom
    )

    $verification = [System.IO.File]::ReadAllText(
        $targetPath
    )

    foreach ($check in $checks) {
        if (-not $verification.Contains($check)) {
            throw "Verification apres ecriture echouee : $check"
        }
    }
}
catch {
    Write-Host ""
    Write-Host "Erreur pendant la correction 12.62c."
    Write-Host "Restauration..."

    Copy-Item `
        -LiteralPath $backupPath `
        -Destination $targetPath `
        -Force

    throw
}

Write-Host ""
Write-Host "OK - BrainReadinessCard repare."
Write-Host "OK - template literal PowerShell supprime."
Write-Host "OK - progression preservee."
Write-Host "OK - confirmation preservee."
Write-Host ""