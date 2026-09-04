import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const route = fs.readFileSync(
  path.join(process.cwd(), "app/api/quotes/route.ts"),
  "utf8"
);
const templates = fs.readFileSync(
  path.join(process.cwd(), "lib/email/templates.ts"),
  "utf8"
);

const patchRoute = route.slice(
  route.indexOf("export async function PATCH")
);

describe("quote lifecycle transactional email contract", () => {
  it("schedules lifecycle email only after a successful core PATCH", () => {
    const corePatchIndex = patchRoute.indexOf(
      "const response = await corePatch(request);"
    );
    const securedResponseIndex = patchRoute.indexOf(
      "const securedResponse = await secureCoreResponse(",
      corePatchIndex
    );
    const successGuardIndex = patchRoute.indexOf(
      "if (securedResponse.ok)",
      securedResponseIndex
    );
    const afterIndex = patchRoute.indexOf(
      "after(async () =>",
      successGuardIndex
    );
    const emailIndex = patchRoute.indexOf(
      "await sendKlyxProfileTransactionalEmail(email);",
      afterIndex
    );

    expect(corePatchIndex).toBeGreaterThanOrEqual(0);
    expect(securedResponseIndex).toBeGreaterThan(corePatchIndex);
    expect(successGuardIndex).toBeGreaterThan(securedResponseIndex);
    expect(afterIndex).toBeGreaterThan(successGuardIndex);
    expect(emailIndex).toBeGreaterThan(afterIndex);
  });

  it("resolves the persisted quote participants inside the deferred task", () => {
    const afterIndex = patchRoute.indexOf("after(async () =>");
    const lookupIndex = patchRoute.indexOf(
      '.from("service_quotes")',
      afterIndex
    );
    const sendIndex = patchRoute.indexOf(
      "await sendKlyxProfileTransactionalEmail(email);",
      lookupIndex
    );

    expect(lookupIndex).toBeGreaterThan(afterIndex);
    expect(sendIndex).toBeGreaterThan(lookupIndex);
    expect(patchRoute).toContain(
      '"client_profile_id, provider_profile_id"'
    );
  });

  it("stops deferred delivery when the quote participant lookup fails", () => {
    const lookupFailureIndex = patchRoute.indexOf(
      "if (quoteError || !quote)"
    );
    const warningIndex = patchRoute.indexOf(
      'event: "quote_lifecycle_email_lookup_failed"',
      lookupFailureIndex
    );
    const returnIndex = patchRoute.indexOf(
      "return;",
      warningIndex
    );
    const emailIndex = patchRoute.indexOf(
      "await sendKlyxProfileTransactionalEmail(email);",
      returnIndex
    );

    expect(lookupFailureIndex).toBeGreaterThanOrEqual(0);
    expect(warningIndex).toBeGreaterThan(lookupFailureIndex);
    expect(returnIndex).toBeGreaterThan(warningIndex);
    expect(emailIndex).toBeGreaterThan(returnIndex);
  });

  it("targets the client for sent quotes and the provider for client decisions", () => {
    expect(route).toContain(
      "profileId: quote.client_profile_id"
    );
    expect(route).toContain(
      "profileId: quote.provider_profile_id"
    );
    expect(route).toContain("quoteSentEmail(quoteId)");
    expect(route).toContain("quoteAcceptedEmail()");
    expect(route).toContain("quoteRejectedEmail()");
    expect(route).toContain("quoteCancelledEmail()");
    expect(templates).toContain("Votre devis KLYX est prêt");
    expect(templates).toContain("Votre devis a été accepté");
    expect(templates).toContain("Votre devis n’a pas été retenu");
    expect(templates).toContain("Une demande de devis a été annulée");
  });
});
