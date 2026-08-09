$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host ""
Write-Host "KLYX ETAPE 12.5 - SECURITY GATE" -ForegroundColor Cyan
Write-Host ""

$path = Join-Path $root "app\api\founder\test-center\route.ts"

if (-not (Test-Path -LiteralPath $path)) {
  throw "app\api\founder\test-center\route.ts introuvable."
}

$content = Get-Content -LiteralPath $path -Raw

if ($content.Contains('id: "security-rls"')) {
  Write-Host "[OK] Security Gate deja present." -ForegroundColor Green
  exit 0
}

$marker = @'
    const { error: favoritesError } = await supabaseAdmin
'@

if (-not $content.Contains($marker)) {
  throw "Point d'insertion introuvable. Aucun remplacement force."
}

$securityBlock = @'
    const criticalSecurityTables = new Set([
      "profiles",
      "user_services",
      "service_profiles",
      "provider_profiles",
      "provider_service_zones",
      "availability_slots",
      "favorites",
      "bookings",
      "service_quotes",
      "messages",
      "reviews",
      "disputes",
      "notifications",
    ]);

    const { data: securityRows, error: securityAuditError } =
      await supabaseAdmin.rpc("klyx_security_audit");

    if (securityAuditError) {
      checks.push(
        warning(
          "security-rls",
          "Sécurité",
          "Audit RLS Supabase",
          `Audit indisponible : ${securityAuditError.message}. Exécute la migration 12.5 dans Supabase.`
        )
      );
    } else {
      const rows = (securityRows ?? []) as Array<{
        table_name: string;
        rls_enabled: boolean;
        policy_count: number;
      }>;

      const existingNames = new Set(
        rows.map((row) => row.table_name)
      );

      const missingTables = Array.from(
        criticalSecurityTables
      ).filter((name) => !existingNames.has(name));

      const unsafeRows = rows.filter(
        (row) =>
          !row.rls_enabled ||
          Number(row.policy_count ?? 0) === 0
      );

      if (unsafeRows.length === 0) {
        checks.push(
          ok(
            "security-rls",
            "Sécurité",
            "RLS Supabase",
            `${rows.length} table(s) critique(s) existante(s) avec RLS et au moins une policy.`
          )
        );
      } else {
        checks.push(
          error(
            "security-rls",
            "Sécurité",
            "RLS Supabase",
            unsafeRows
              .map(
                (row) =>
                  `${row.table_name}: RLS=${
                    row.rls_enabled ? "ON" : "OFF"
                  }, policies=${row.policy_count}`
              )
              .join(" | ")
          )
        );
      }

      checks.push(
        missingTables.length === 0
          ? ok(
              "security-schema",
              "Sécurité",
              "Tables critiques",
              "Toutes les tables critiques attendues existent."
            )
          : warning(
              "security-schema",
              "Sécurité",
              "Tables critiques",
              `Tables absentes ou non encore utilisées : ${missingTables.join(
                ", "
              )}`
            )
      );
    }

'@

$content = $content.Replace($marker, $securityBlock + $marker)

[System.IO.File]::WriteAllText(
  $path,
  $content,
  [System.Text.UTF8Encoding]::new($false)
)

Write-Host "[OK] Test Center enrichi avec Security Gate." -ForegroundColor Green
