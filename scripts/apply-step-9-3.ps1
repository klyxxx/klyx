$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$file = Join-Path $root "app\api\provider\skills-verification\route.ts"

if (-not (Test-Path -LiteralPath $file)) {
  throw "Fichier introuvable : app\api\provider\skills-verification\route.ts"
}

$backup = "$file.step-9-3.backup"
if (-not (Test-Path -LiteralPath $backup)) {
  Copy-Item -LiteralPath $file -Destination $backup -Force
}

$content = Get-Content -LiteralPath $file -Raw -Encoding UTF8

$anchorImport = 'import { supabaseAdmin } from "@/lib/supabase-admin";'
$skillImport = @'
import {
  evaluateSkillEvidence,
  getSkillQualificationRule,
} from "@/lib/skill-qualification";
'@

if (-not $content.Contains('from "@/lib/skill-qualification"')) {
  if (-not $content.Contains($anchorImport)) { throw "Import supabaseAdmin introuvable." }
  $content = $content.Replace($anchorImport, $anchorImport + "`r`n" + $skillImport.Trim())
}

$old = @'
    if (body.submit === true) {
      const { count, error: countError } =
        await supabaseAdmin
          .from("provider_skill_documents")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq(
            "verification_id",
            verification.id
          );

      if (countError) {
        throw new Error(countError.message);
      }

      if (!count || count < 1) {
        throw new Error(
          "Ajoute au moins une preuve avant d’envoyer cette compétence."
        );
      }

      if (statement.length < 30) {
        throw new Error(
          "Explique en au moins 30 caractères pourquoi tu peux réaliser cette prestation."
        );
      }
    }
'@

$new = @'
    if (body.submit === true) {
      const { data: ownedService, error: ownedServiceError } =
        await supabaseAdmin
          .from("user_services")
          .select("id, service_id")
          .eq("id", userServiceId)
          .eq("user_id", profile.id)
          .single();

      if (ownedServiceError) throw new Error(ownedServiceError.message);

      const { data: service, error: serviceError } =
        await supabaseAdmin
          .from("services")
          .select("id, name, slug")
          .eq("id", ownedService.service_id)
          .single();

      if (serviceError) throw new Error(serviceError.message);

      const { data: documents, error: documentsError } =
        await supabaseAdmin
          .from("provider_skill_documents")
          .select("proof_type, status")
          .eq("verification_id", verification.id);

      if (documentsError) throw new Error(documentsError.message);

      const { data: generalVerification, error: generalError } =
        await supabaseAdmin
          .from("provider_verifications")
          .select("identity_status")
          .eq("profile_id", profile.id)
          .maybeSingle();

      if (generalError) throw new Error(generalError.message);

      const rule = await getSkillQualificationRule({
        countryCode: typeof profile.country_code === "string" ? profile.country_code : "BE",
        serviceSlug: service.slug,
      });

      const evaluation = evaluateSkillEvidence({
        rule,
        proofTypes: (documents ?? [])
          .filter((document) => document.status !== "rejected")
          .map((document) => document.proof_type),
        yearsExperience: years,
        identityApproved: generalVerification?.identity_status === "approved",
      });

      if (!evaluation.identityOk) {
        throw new Error("Ta vérification d'identité doit être validée avant l'envoi de cette compétence.");
      }

      if (!evaluation.experienceOk) {
        throw new Error(`KLYX demande au moins ${rule.minimumYearsExperience} année(s) d'expérience pour ce métier.`);
      }

      if (evaluation.missingProofTypes.length > 0) {
        throw new Error(`Preuves obligatoires manquantes : ${evaluation.missingProofTypes.join(", ")}.`);
      }

      if (statement.length < 30) {
        throw new Error("Explique en au moins 30 caractères pourquoi tu peux réaliser cette prestation.");
      }
    }
'@

if ($content.Contains($old)) {
  $content = $content.Replace($old, $new)
}
elseif (-not $content.Contains("evaluation.missingProofTypes")) {
  throw "Bloc de soumission 9.0 introuvable."
}

Set-Content -LiteralPath $file -Value $content -Encoding UTF8

Write-Host ""
Write-Host "ETAPE 9.3 APPLIQUEE." -ForegroundColor Green
Write-Host "Les regles metier/pays bloquent maintenant les dossiers incomplets."
Write-Host ""
Write-Host "Execute maintenant : npm run build"
