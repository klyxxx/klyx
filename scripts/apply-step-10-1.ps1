$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "KLYX ETAPE 10.1 - ENTREE INTELLIGENTE" -ForegroundColor Cyan
Write-Host ""

# ============================================================
# FICHIERS
# ============================================================

$homeFile = Join-Path $root "app\page.tsx"
$signupFile = Join-Path $root "app\signup\page.tsx"
$componentFile = Join-Path $root "app\components\PublicSessionActions.tsx"

if (-not (Test-Path -LiteralPath $homeFile)) {
    throw "Fichier introuvable : app\page.tsx"
}

if (-not (Test-Path -LiteralPath $signupFile)) {
    throw "Fichier introuvable : app\signup\page.tsx"
}

if (-not (Test-Path -LiteralPath $componentFile)) {
    throw "Fichier introuvable : app\components\PublicSessionActions.tsx"
}

# ============================================================
# BACKUPS
# ============================================================

$homeBackup = "$homeFile.step-10-1.backup"
$signupBackup = "$signupFile.step-10-1.backup"

if (-not (Test-Path -LiteralPath $homeBackup)) {
    Copy-Item `
        -LiteralPath $homeFile `
        -Destination $homeBackup `
        -Force
}

if (-not (Test-Path -LiteralPath $signupBackup)) {
    Copy-Item `
        -LiteralPath $signupFile `
        -Destination $signupBackup `
        -Force
}

# ============================================================
# 1. ACCUEIL
# ============================================================

$homeContent = Get-Content `
    -LiteralPath $homeFile `
    -Raw `
    -Encoding UTF8

$sessionImport = @'
import PublicSessionActions from "@/app/components/PublicSessionActions";
'@

$logoImport = @'
import KlyxLogo from "@/app/ui/KlyxLogo";
'@

if (-not $homeContent.Contains($sessionImport.Trim())) {

    if (-not $homeContent.Contains($logoImport.Trim())) {
        throw "Import KlyxLogo introuvable dans app\page.tsx"
    }

    $homeContent = $homeContent.Replace(
        $logoImport.Trim(),
        $logoImport.Trim() + "`r`n" + $sessionImport.Trim()
    )
}

# ------------------------------------------------------------
# HEADER
# ------------------------------------------------------------

if (-not $homeContent.Contains("<PublicSessionActions compact />")) {

    $headerStart = $homeContent.IndexOf(
        '<Link' + "`r`n" + '              href="/login"'
    )

    if ($headerStart -lt 0) {
        $headerStart = $homeContent.IndexOf(
            '<Link' + "`n" + '              href="/login"'
        )
    }

    if ($headerStart -lt 0) {
        throw "Bouton Se connecter du header introuvable."
    }

    $signupStart = $homeContent.IndexOf(
        '<Link',
        $headerStart + 1
    )

    if ($signupStart -lt 0) {
        throw "Bouton Creer un compte du header introuvable."
    }

    $signupHrefPosition = $homeContent.IndexOf(
        'href="/signup"',
        $signupStart
    )

    if ($signupHrefPosition -lt 0) {
        throw "Lien /signup du header introuvable."
    }

    $signupEnd = $homeContent.IndexOf(
        "</Link>",
        $signupHrefPosition
    )

    if ($signupEnd -lt 0) {
        throw "Fin du bouton signup du header introuvable."
    }

    $signupEnd += "</Link>".Length

    $before = $homeContent.Substring(
        0,
        $headerStart
    )

    $after = $homeContent.Substring(
        $signupEnd
    )

    $replacement = @'
<PublicSessionActions compact />
'@

    $homeContent =
        $before +
        $replacement.Trim() +
        $after
}

# ------------------------------------------------------------
# HERO
# ------------------------------------------------------------

if (-not $homeContent.Contains("<PublicSessionActions />")) {

    $heroMarker = "Commencer avec KLYX"

    $heroTextPosition = $homeContent.IndexOf(
        $heroMarker
    )

    if ($heroTextPosition -lt 0) {
        throw "Bouton Commencer avec KLYX introuvable."
    }

    $heroStart = $homeContent.LastIndexOf(
        "<Link",
        $heroTextPosition
    )

    if ($heroStart -lt 0) {
        throw "Debut du bouton principal introuvable."
    }

    $loginStart = $homeContent.IndexOf(
        "<Link",
        $heroTextPosition
    )

    if ($loginStart -lt 0) {
        throw "Deuxieme bouton du hero introuvable."
    }

    $loginHrefPosition = $homeContent.IndexOf(
        'href="/login"',
        $loginStart
    )

    if ($loginHrefPosition -lt 0) {
        throw "Lien /login du hero introuvable."
    }

    $loginEnd = $homeContent.IndexOf(
        "</Link>",
        $loginHrefPosition
    )

    if ($loginEnd -lt 0) {
        throw "Fin du bouton login du hero introuvable."
    }

    $loginEnd += "</Link>".Length

    $before = $homeContent.Substring(
        0,
        $heroStart
    )

    $after = $homeContent.Substring(
        $loginEnd
    )

    $replacement = @'
<PublicSessionActions />
'@

    $homeContent =
        $before +
        $replacement.Trim() +
        $after
}

Set-Content `
    -LiteralPath $homeFile `
    -Value $homeContent `
    -Encoding UTF8

Write-Host "[OK] Accueil intelligent selon session" -ForegroundColor Green

# ============================================================
# 2. SIGNUP
# ============================================================

$signup = Get-Content `
    -LiteralPath $signupFile `
    -Raw `
    -Encoding UTF8

# ------------------------------------------------------------
# IMPORT useEffect
# ------------------------------------------------------------

$oldReactImport = @'
import { FormEvent, useState } from "react";
'@

$newReactImport = @'
import { FormEvent, useEffect, useState } from "react";
'@

if (
    $signup.Contains($oldReactImport.Trim()) -and
    -not $signup.Contains("useEffect, useState")
) {
    $signup = $signup.Replace(
        $oldReactImport.Trim(),
        $newReactImport.Trim()
    )
}

# ------------------------------------------------------------
# ETAT SESSION
# ------------------------------------------------------------

if (-not $signup.Contains("checkingSession")) {

    $loadingState = @'
  const [loading, setLoading] = useState(false);
'@

    $sessionState = @'
  const [loading, setLoading] = useState(false);

  const [checkingSession, setCheckingSession] =
    useState(true);

  useEffect(() => {
    let active = true;

    async function checkSession() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) {
        return;
      }

      if (user) {
        router.replace("/dashboard");
        router.refresh();
        return;
      }

      setCheckingSession(false);
    }

    void checkSession();

    return () => {
      active = false;
    };
  }, [router]);
'@

    if (-not $signup.Contains($loadingState.TrimEnd())) {
        throw "Etat loading introuvable dans app\signup\page.tsx"
    }

    $signup = $signup.Replace(
        $loadingState.TrimEnd(),
        $sessionState.TrimEnd()
    )
}

# ------------------------------------------------------------
# ECRAN DE VERIFICATION
# ------------------------------------------------------------

if (-not $signup.Contains("if (checkingSession)")) {

    $returnMarker = @'
  return (
    <main
'@

    $returnPosition = $signup.IndexOf(
        $returnMarker.TrimEnd()
    )

    if ($returnPosition -lt 0) {

        $returnMarker = @'
  return (
    <main className=
'@

        $returnPosition = $signup.IndexOf(
            $returnMarker.TrimEnd()
        )
    }

    if ($returnPosition -lt 0) {
        throw "Return principal introuvable dans signup."
    }

    $sessionGuard = @'
  if (checkingSession) {
    return (
      <main className="grid min-h-screen place-items-center bg-zinc-950 text-white">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-violet-500"
          aria-label="Verification de la session"
        />
      </main>
    );
  }

'@

    $signup =
        $signup.Insert(
            $returnPosition,
            $sessionGuard
        )
}

Set-Content `
    -LiteralPath $signupFile `
    -Value $signup `
    -Encoding UTF8

Write-Host "[OK] Signup protege si session active" -ForegroundColor Green

# ============================================================
# FIN
# ============================================================

Write-Host ""
Write-Host "ETAPE 10.1 APPLIQUEE." -ForegroundColor Green
Write-Host ""
Write-Host "Deconnecte :" -ForegroundColor Cyan
Write-Host "  Se connecter"
Write-Host "  Creer un compte"
Write-Host ""
Write-Host "Connecte :" -ForegroundColor Cyan
Write-Host "  Ouvrir KLYX"
Write-Host "  Mes profils"
Write-Host ""
Write-Host "Signup :" -ForegroundColor Cyan
Write-Host "  utilisateur connecte -> dashboard"
Write-Host ""
Write-Host "Execute maintenant :" -ForegroundColor Yellow
Write-Host "npm run build"
