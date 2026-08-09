$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$file = Join-Path $root "app\provider\skills\page.tsx"

if (-not (Test-Path -LiteralPath $file)) {
  throw "Fichier introuvable : app\provider\skills\page.tsx"
}

$backup = "$file.step-9-4.backup"
if (-not (Test-Path -LiteralPath $backup)) {
  Copy-Item -LiteralPath $file -Destination $backup -Force
}

$content = Get-Content -LiteralPath $file -Raw -Encoding UTF8

$importAnchor = 'import KlyxSelect from "@/app/components/KlyxSelect";'
$panelImport = 'import SkillRequirementsPanel from "@/app/provider/skills/SkillRequirementsPanel";'

if (-not $content.Contains($panelImport)) {
  if (-not $content.Contains($importAnchor)) {
    throw "Import KlyxSelect introuvable."
  }

  $content = $content.Replace(
    $importAnchor,
    $importAnchor + "`r`n" + $panelImport
  )
}

$stateAnchor = @'
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
'@

$stateReplacement = @'
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [requirementsReady, setRequirementsReady] =
    useState<Record<string, boolean>>({});
'@

if (-not $content.Contains("requirementsReady")) {
  if (-not $content.Contains($stateAnchor)) {
    throw "Bloc state introuvable."
  }

  $content = $content.Replace(
    $stateAnchor,
    $stateReplacement
  )
}

$functionAnchor = @'
  async function token() {
'@

$functionReplacement = @'
  function handleRequirementReady(
    userServiceId: string,
    ready: boolean
  ) {
    setRequirementsReady((current) => {
      if (current[userServiceId] === ready) {
        return current;
      }

      return {
        ...current,
        [userServiceId]: ready,
      };
    });
  }

  async function token() {
'@

if (-not $content.Contains("handleRequirementReady(")) {
  if (-not $content.Contains($functionAnchor)) {
    throw "Fonction token introuvable."
  }

  $content = $content.Replace(
    $functionAnchor,
    $functionReplacement
  )
}

$proofAnchor = @'
                  <div className="mt-5">
                    <p className="text-sm font-black">
                      Preuves ajoutées
                    </p>
'@

$panelBlock = @'
                  <SkillRequirementsPanel
                    userServiceId={skill.userServiceId}
                    refreshKey={[
                      verification?.documents.length ?? 0,
                      years[skill.userServiceId] ?? 0,
                      verification?.status ?? "not_started",
                    ].join(":")}
                    onReadyChange={handleRequirementReady}
                  />

                  <div className="mt-5">
                    <p className="text-sm font-black">
                      Preuves ajoutées
                    </p>
'@

if (-not $content.Contains("<SkillRequirementsPanel")) {
  if (-not $content.Contains($proofAnchor)) {
    throw "Bloc Preuves ajoutees introuvable."
  }

  $content = $content.Replace(
    $proofAnchor,
    $panelBlock
  )
}

$buttonPattern = '(?s)<button\s+type="button"\s+disabled=\{\s*busy ===\s*skill\.userServiceId\s*\}\s+onClick=\{\(\)\s*=>\s*void save\(skill, true\)\s*\}\s+className="inline-flex h-11 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-black text-white"\s*>'

$buttonReplacement = @'
<button
  type="button"
  disabled={
    busy === skill.userServiceId ||
    requirementsReady[
      skill.userServiceId
    ] !== true
  }
  title={
    requirementsReady[
      skill.userServiceId
    ] === true
      ? "Envoyer cette compétence à KLYX"
      : "Complète d'abord toutes les exigences obligatoires."
  }
  onClick={() =>
    void save(skill, true)
  }
  className="inline-flex h-11 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-45"
>
'@

$updated = [regex]::Replace(
  $content,
  $buttonPattern,
  $buttonReplacement,
  1
)

if ($updated -eq $content -and -not $content.Contains('requirementsReady[')) {
  throw "Bouton Envoyer a KLYX introuvable."
}

$content = $updated

Set-Content -LiteralPath $file -Value $content -Encoding UTF8

Write-Host ""
Write-Host "ETAPE 9.4 APPLIQUEE." -ForegroundColor Green
Write-Host "Exigences visibles + bouton Envoyer bloque si dossier incomplet."
Write-Host ""
Write-Host "Execute maintenant : npm run build"
