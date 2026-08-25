import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import type { ProviderQualificationLevel } from "@/lib/provider-search";

export type QualificationUserServiceInput = {
  id: string;
  serviceId: string;
};

export type QualificationServiceInput = {
  id: string;
  slug: string;
};

export type QualificationZoneInput = {
  userServiceId: string;
  countryCode: string;
};

export type PublicProviderQualification = {
  level: ProviderQualificationLevel;
  approved: boolean;
  label: string;
  officialRegistrationLabel: string | null;
};

type RuleRow = {
  country_code: string;
  service_slug: string;
  rule_level: ProviderQualificationLevel;
  official_registration_required: boolean;
  official_registration_label: string | null;
};

const RULE_PRIORITY: Record<ProviderQualificationLevel, number> = {
  self_declared: 1,
  evidence_required: 2,
  regulated: 3,
};

function normalizeCountryCode(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

function qualificationLabel(
  level: ProviderQualificationLevel,
  approved: boolean
): string {
  if (level === "self_declared") {
    return "Compétence déclarée par le prestataire";
  }

  if (approved && level === "regulated") {
    return "Qualification réglementée approuvée par KLYX";
  }

  if (approved) {
    return "Justificatifs professionnels approuvés par KLYX";
  }

  if (level === "regulated") {
    return "Qualification réglementée";
  }

  return "Compétence avec justificatifs";
}

export async function loadPublicProviderQualifications(params: {
  userServices: readonly QualificationUserServiceInput[];
  services: readonly QualificationServiceInput[];
  zones: readonly QualificationZoneInput[];
  approvedUserServiceIds?: ReadonlySet<string>;
}): Promise<Map<string, PublicProviderQualification>> {
  const serviceById = new Map(
    params.services.map((service) => [service.id, service])
  );
  const zonesByUserService = new Map<string, string[]>();

  for (const zone of params.zones) {
    const countryCode = normalizeCountryCode(zone.countryCode);
    if (!countryCode) continue;

    const current = zonesByUserService.get(zone.userServiceId) ?? [];
    if (!current.includes(countryCode)) current.push(countryCode);
    zonesByUserService.set(zone.userServiceId, current);
  }

  const countryCodes = [
    ...new Set(
      [...zonesByUserService.values()].flat()
    ),
  ];
  const serviceSlugs = [
    ...new Set(
      params.userServices
        .map((userService) => serviceById.get(userService.serviceId)?.slug ?? "")
        .filter(Boolean)
    ),
  ];

  let rules: RuleRow[] = [];

  if (countryCodes.length > 0 && serviceSlugs.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("skill_qualification_rules")
      .select(
        "country_code,service_slug,rule_level,official_registration_required,official_registration_label"
      )
      .in("country_code", countryCodes)
      .in("service_slug", serviceSlugs)
      .eq("enabled", true);

    if (error) throw new Error(error.message);
    rules = (data ?? []) as RuleRow[];
  }

  const ruleByCountryAndService = new Map(
    rules.map((rule) => [
      `${rule.country_code.trim().toUpperCase()}|${rule.service_slug}`,
      rule,
    ])
  );
  const result = new Map<string, PublicProviderQualification>();

  for (const userService of params.userServices) {
    const service = serviceById.get(userService.serviceId);
    const countryCodesForService =
      zonesByUserService.get(userService.id) ?? [];

    let selectedRule: RuleRow | null = null;
    let selectedLevel: ProviderQualificationLevel | null = null;

    if (service) {
      for (const countryCode of countryCodesForService) {
        const rule = ruleByCountryAndService.get(
          `${countryCode}|${service.slug}`
        );

        // An active country without an explicit qualification rule is
        // self-declared. Explicit evidence_required or regulated rules keep
        // their higher priority, including for multi-country providers.
        const candidateLevel: ProviderQualificationLevel =
          rule?.rule_level ?? "self_declared";
        const candidatePriority = RULE_PRIORITY[candidateLevel];
        const selectedPriority = selectedLevel
          ? RULE_PRIORITY[selectedLevel]
          : 0;
        const candidateNeedsOfficialRegistration =
          rule?.official_registration_required === true;
        const selectedNeedsOfficialRegistration =
          selectedRule?.official_registration_required === true;

        if (
          candidatePriority > selectedPriority ||
          (candidatePriority === selectedPriority &&
            candidateNeedsOfficialRegistration &&
            !selectedNeedsOfficialRegistration)
        ) {
          selectedLevel = candidateLevel;
          selectedRule = rule ?? null;
        }
      }
    }

    const level: ProviderQualificationLevel =
      selectedLevel ?? "self_declared";
    const approved =
      params.approvedUserServiceIds?.has(userService.id) === true;

    result.set(userService.id, {
      level,
      approved,
      label: qualificationLabel(level, approved),
      officialRegistrationLabel:
        selectedRule?.official_registration_required === true
          ? selectedRule.official_registration_label?.trim() || null
          : null,
    });
  }

  return result;
}
