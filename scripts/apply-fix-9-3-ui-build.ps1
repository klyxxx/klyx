$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

# ============================================================
# 1. api-auth : ajouter countryCode au profil authentifie
# ============================================================

$authFile = Join-Path $root "lib\api-auth.ts"

if (-not (Test-Path -LiteralPath $authFile)) {
  throw "Fichier introuvable : lib\api-auth.ts"
}

$auth = Get-Content -LiteralPath $authFile -Raw -Encoding UTF8

if (-not $auth.Contains("countryCode: string;")) {
  $auth = $auth.Replace(
@'
  firstName: string;
  lastName: string;
};
'@,
@'
  firstName: string;
  lastName: string;
  countryCode: string;
};
'@
  )
}

if (-not $auth.Contains("country_code: string | null;")) {
  $auth = $auth.Replace(
@'
  first_name: string | null;
  last_name: string | null;
};
'@,
@'
  first_name: string | null;
  last_name: string | null;
  country_code: string | null;
};
'@
  )
}

if (-not $auth.Contains('countryCode: profile.country_code')) {
  $auth = $auth.Replace(
@'
    firstName: profile.first_name ?? "",
    lastName: profile.last_name ?? "",
  };
'@,
@'
    firstName: profile.first_name ?? "",
    lastName: profile.last_name ?? "",
    countryCode:
      typeof profile.country_code === "string" &&
      /^[A-Z]{2}$/i.test(profile.country_code)
        ? profile.country_code.toUpperCase()
        : "BE",
  };
'@
  )
}

$auth = $auth.Replace(
'.select("id, owner_user_id, account_type, first_name, last_name")',
'.select("id, owner_user_id, account_type, first_name, last_name, country_code")'
)

Set-Content -LiteralPath $authFile -Value $auth -Encoding UTF8
Write-Host "[OK] lib\api-auth.ts" -ForegroundColor Green

# ============================================================
# 2. Corriger 9.3 : profile.country_code -> profile.countryCode
# ============================================================

$filesToFix = @(
  "app\api\provider\skill-requirements\route.ts",
  "app\api\provider\skills-verification\route.ts"
)

foreach ($relative in $filesToFix) {
  $file = Join-Path $root $relative

  if (-not (Test-Path -LiteralPath $file)) {
    throw "Fichier introuvable : $relative"
  }

  $content = Get-Content -LiteralPath $file -Raw -Encoding UTF8

  $content = $content.Replace(
    'typeof profile.country_code === "string" ? profile.country_code : "BE"',
    'profile.countryCode'
  )

  Set-Content -LiteralPath $file -Value $content -Encoding UTF8
  Write-Host "[OK] $relative" -ForegroundColor Green
}

# ============================================================
# 3. Mes competences : remplacer le select natif par KlyxSelect
# ============================================================

$skillsFile = Join-Path $root "app\provider\skills\page.tsx"

if (-not (Test-Path -LiteralPath $skillsFile)) {
  throw "Fichier introuvable : app\provider\skills\page.tsx"
}

$skills = Get-Content -LiteralPath $skillsFile -Raw -Encoding UTF8

$importAnchor =
  'import { getActiveClientProfile } from "@/lib/account-switcher";'

$selectImport =
  'import KlyxSelect from "@/app/components/KlyxSelect";'

if (-not $skills.Contains($selectImport)) {
  if (-not $skills.Contains($importAnchor)) {
    throw "Import account-switcher introuvable dans Mes competences."
  }

  $skills = $skills.Replace(
    $importAnchor,
    $importAnchor + "`r`n" + $selectImport
  )
}

$selectPattern = '(?s)<select\s+disabled=\{locked\}\s+value=\{\s*proofTypes\[\s*skill\.userServiceId\s*\]\s*\?\?\s*"training_certificate"\s*\}\s+onChange=\{\(event\)\s*=>\s*setProofTypes\(\s*\(current\)\s*=>\s*\(\{\s*\.\.\.current,\s*\[skill\.userServiceId\]:\s*event\.target\s*\.value as ProofType,\s*\}\)\s*\)\s*\}\s+className="klyx-input mt-2"\s*>\s*\{PROOFS\.map\(\(proof\)\s*=>\s*\(\s*<option\s+key=\{proof\.value\}\s+value=\{proof\.value\}\s*>\s*\{proof\.label\}\s*</option>\s*\)\)\}\s*</select>'

$selectReplacement = @'
<KlyxSelect
  disabled={locked}
  value={
    proofTypes[
      skill.userServiceId
    ] ?? "training_certificate"
  }
  onChange={(value) =>
    setProofTypes(
      (current) => ({
        ...current,
        [skill.userServiceId]:
          value as ProofType,
      })
    )
  }
  options={PROOFS}
  placeholder="Choisir un type de preuve"
  ariaLabel={`Type de preuve pour ${skill.serviceName}`}
  className="mt-2"
/>
'@

$updatedSkills = [regex]::Replace(
  $skills,
  $selectPattern,
  $selectReplacement,
  1
)

if ($updatedSkills -eq $skills) {
  if (-not $skills.Contains("<KlyxSelect")) {
    throw "Select Type de preuve introuvable dans app\provider\skills\page.tsx"
  }
}
else {
  $skills = $updatedSkills
}

Set-Content -LiteralPath $skillsFile -Value $skills -Encoding UTF8
Write-Host "[OK] app\provider\skills\page.tsx" -ForegroundColor Green

# ============================================================
# 4. KlyxSelect : scrollbar premium
# ============================================================

$selectFile = Join-Path $root "app\components\KlyxSelect.tsx"

if (-not (Test-Path -LiteralPath $selectFile)) {
  throw "Fichier introuvable : app\components\KlyxSelect.tsx"
}

$select = Get-Content -LiteralPath $selectFile -Raw -Encoding UTF8

$select = $select.Replace(
'className="absolute left-0 right-0 z-[140] mt-2 max-h-72 overflow-y-auto rounded-2xl border border-white/10 bg-zinc-950/95 p-2 shadow-2xl backdrop-blur-2xl"',
'className="klyx-scrollbar absolute left-0 right-0 z-[140] mt-2 max-h-72 overflow-y-auto rounded-2xl border border-white/10 bg-zinc-950/95 p-2 shadow-2xl backdrop-blur-2xl"'
)

Set-Content -LiteralPath $selectFile -Value $select -Encoding UTF8
Write-Host "[OK] app\components\KlyxSelect.tsx" -ForegroundColor Green

# ============================================================
# 5. Sidebar : scrollbar KLYX
# ============================================================

$sidebarFile = Join-Path $root "app\ui\AppSidebar.tsx"

if (Test-Path -LiteralPath $sidebarFile) {
  $sidebar = Get-Content -LiteralPath $sidebarFile -Raw -Encoding UTF8

  $sidebar = $sidebar.Replace(
'className="flex-1 space-y-1 overflow-y-auto px-3 py-2"',
'className="klyx-scrollbar flex-1 space-y-1 overflow-y-auto px-3 py-2"'
  )

  Set-Content -LiteralPath $sidebarFile -Value $sidebar -Encoding UTF8
  Write-Host "[OK] app\ui\AppSidebar.tsx" -ForegroundColor Green
}

# ============================================================
# 6. globals.css : style scrollbar KLYX
# ============================================================

$cssFile = Join-Path $root "app\globals.css"

if (-not (Test-Path -LiteralPath $cssFile)) {
  throw "Fichier introuvable : app\globals.css"
}

$css = Get-Content -LiteralPath $cssFile -Raw -Encoding UTF8

if (-not $css.Contains("KLYX PREMIUM SCROLLBAR")) {
  $css += @'

/* KLYX PREMIUM SCROLLBAR */
.klyx-scrollbar {
  scrollbar-width: thin;
  scrollbar-color:
    rgba(139, 92, 246, 0.55)
    transparent;
}

.klyx-scrollbar::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.klyx-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.klyx-scrollbar::-webkit-scrollbar-thumb {
  background:
    linear-gradient(
      180deg,
      rgba(124, 58, 237, 0.75),
      rgba(79, 70, 229, 0.65)
    );
  border: 2px solid transparent;
  border-radius: 999px;
  background-clip: padding-box;
}

.klyx-scrollbar::-webkit-scrollbar-thumb:hover {
  background:
    linear-gradient(
      180deg,
      rgba(139, 92, 246, 0.95),
      rgba(99, 102, 241, 0.9)
    );
  border: 2px solid transparent;
  background-clip: padding-box;
}

.klyx-scrollbar::-webkit-scrollbar-button {
  display: none;
}
'@
}

Set-Content -LiteralPath $cssFile -Value $css -Encoding UTF8
Write-Host "[OK] app\globals.css" -ForegroundColor Green

Write-Host ""
Write-Host "CORRECTIF 9.3 APPLIQUE." -ForegroundColor Green
Write-Host "- countryCode ajoute au profil authentifie"
Write-Host "- Type de preuve converti en KlyxSelect"
Write-Host "- scrollbar sidebar + menus harmonisee"
Write-Host ""
Write-Host "Execute maintenant : npm run build"
