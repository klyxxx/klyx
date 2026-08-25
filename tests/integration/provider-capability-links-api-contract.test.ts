import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const core = readFileSync(
  join(
    process.cwd(),
    "app/api/provider/capability-links/capability-links-route-core.ts"
  ),
  "utf8"
);

const route = readFileSync(
  join(process.cwd(), "app/api/provider/capability-links/route.ts"),
  "utf8"
);

describe("provider capability links API contract", () => {
  it("requires the active provider profile for every operation", () => {
    expect(core.match(/getAuthenticatedProfile\(request\)/g)?.length).toBe(3);
    expect(core.match(/requireAccountType\(profile, "provider"\)/g)?.length).toBe(3);
    expect(core).toContain('.eq("profile_id", profile.id)');
  });

  it("validates both parents against the exact active profile before linking", () => {
    expect(core).toContain("ownsConfirmedCapability(");
    expect(core).toContain("ownsProviderService(");
    expect(core).toContain('.from("provider_capabilities")');
    expect(core).toContain('.eq("profile_id", profileId)');
    expect(core).toContain('.eq("status", "confirmed")');
    expect(core).toContain('.from("user_services")');
    expect(core).toContain('.eq("user_id", profileId)');
    expect(core).toContain('.eq("provider_enabled", true)');
    expect(core).toContain("Promise.all([");
  });

  it("keeps profile ownership server-managed and writes only the descriptive relation", () => {
    expect(core).toContain('"profileId"');
    expect(core).toContain('"profile_id"');
    expect(core).toContain("KLYX_PROVIDER_CAPABILITY_LINK_MANAGED_FIELD");
    expect(core).toContain("profile_id: profile.id");
    expect(core).toContain("capability_id: capabilityId");
    expect(core).toContain("user_service_id: userServiceId");
    expect(core).toContain('.from("provider_service_capabilities")');

    expect(core).not.toContain('.from("provider_capabilities")\n    .update(');
    expect(core).not.toContain('.from("user_services")\n    .update(');
    expect(core).not.toContain('.from("service_profiles").update');
  });

  it("prevents duplicate links and keeps unlink owner-scoped", () => {
    expect(core).toContain("KLYX_PROVIDER_CAPABILITY_LINK_DUPLICATE");
    expect(core).toContain('error?.code === "23505"');
    expect(core).toContain(".delete()");
    expect(core).toContain('.eq("profile_id", profile.id)');
    expect(core).toContain('.eq("capability_id", capabilityId)');
    expect(core).toContain('.eq("user_service_id", userServiceId)');
    expect(core).toContain("KLYX_PROVIDER_CAPABILITY_LINK_NOT_FOUND");
  });

  it("exposes only GET, POST and DELETE through a sanitized API wrapper", () => {
    expect(route).toContain('type Method = "GET" | "POST" | "DELETE"');
    expect(route).toContain("export async function GET");
    expect(route).toContain("export async function POST");
    expect(route).toContain("export async function DELETE");
    expect(route).not.toMatch(/export async function PATCH/);
    expect(route).toContain("secureApiErrorResponse");
    expect(route).toContain("KLYX_PROVIDER_CAPABILITY_LINKS_REQUEST_FAILED");
  });

  it("does not couple link management to qualifications, bookings, payments or trust scoring", () => {
    const executableSource = core
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("//"))
      .join("\n");

    expect(executableSource).not.toMatch(/skill_qualification_rules/i);
    expect(executableSource).not.toMatch(/provider_skill_verifications/i);
    expect(executableSource).not.toMatch(/\bbookings?\b/i);
    expect(executableSource).not.toMatch(/\bpayments?\b/i);
    expect(executableSource).not.toMatch(/\bstripe\b/i);
    expect(executableSource).not.toMatch(/klyx_score/i);
  });
});
