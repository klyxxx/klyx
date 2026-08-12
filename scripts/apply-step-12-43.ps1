$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.43 - ASSISTANT AUTOSTART" -ForegroundColor Cyan
Write-Host ""

$path = "app\assistant\market\page.tsx"
if (-not (Test-Path -LiteralPath $path)) { throw "Fichier manquant : $path" }

$content = Get-Content -LiteralPath $path -Raw

$content = $content.Replace(
'import { FormEvent, useState, useEffect } from "react";',
'import { FormEvent, useState, useEffect, useRef } from "react";'
)

if ($content -notmatch 'autoStartRef') {
  $anchor = 'const router = useRouter();'
  if (-not $content.Contains($anchor)) { throw "router introuvable." }
  $content = $content.Replace(
    $anchor,
    $anchor + "`r`n  const autoStartRef = useRef(false);"
  )
}

$oldEffect = @'
  useEffect(() => {
  const searchParams = new URLSearchParams(window.location.search);
  const initialRequest = searchParams.get("request")?.trim() ?? "";

  if (!initialRequest) return;

  setInput((current) =>
    current.trim() ? current : initialRequest
  );
}, []);
'@

$newEffect = @'
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const initialRequest = searchParams.get("request")?.trim() ?? "";

    if (!initialRequest || autoStartRef.current) return;

    autoStartRef.current = true;
    setInput((current) =>
      current.trim() ? current : initialRequest
    );
  }, []);
'@

if ($content.Contains($oldEffect)) {
  $content = $content.Replace($oldEffect, $newEffect)
} elseif ($content -notmatch 'autoStartRef\.current = true') {
  throw "Effet 12.42B attendu introuvable."
}

# Après définition de sendMessage, déclenche automatiquement l'envoi
# via un second effet seulement lorsque le texte vient de l'URL.
$publishAnchor = '  async function publishRequest() {'
if ($content -notmatch 'KLYX_AUTOSTART_12_43') {
  $idx = $content.IndexOf($publishAnchor)
  if ($idx -lt 0) { throw "publishRequest introuvable." }

  $effect = @'
  // KLYX_AUTOSTART_12_43
  useEffect(() => {
    if (!autoStartRef.current || !input.trim() || loading || conversationId) {
      return;
    }

    const timer = window.setTimeout(() => {
      const form = document.querySelector<HTMLFormElement>(
        'form[data-klyx-market-form="true"]'
      );
      form?.requestSubmit();
    }, 120);

    return () => window.clearTimeout(timer);
  }, [input, loading, conversationId]);

'@
  $content = $content.Insert($idx, $effect)
}

$content = $content.Replace(
'<form' + "`r`n" + '            onSubmit={sendMessage}',
'<form' + "`r`n" + '            data-klyx-market-form="true"' + "`r`n" + '            onSubmit={sendMessage}'
)

[IO.File]::WriteAllText(
  (Resolve-Path -LiteralPath $path),
  $content,
  [Text.UTF8Encoding]::new($false)
)

Write-Host "[OK] Demande Centre KLYX detectee" -ForegroundColor Green
Write-Host "[OK] Analyse automatique declenchee" -ForegroundColor Green
Write-Host "[OK] Un seul autostart par ouverture" -ForegroundColor Green
Write-Host "[OK] Confirmation publication conservee" -ForegroundColor Green
Write-Host ""
Write-Host "12.43 appliquee. Aucune migration SQL." -ForegroundColor Cyan
