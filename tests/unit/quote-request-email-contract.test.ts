import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const route = fs.readFileSync(
  path.join(process.cwd(), "app/api/quotes/route.ts"),
  "utf8"
);
const serverEmail = fs.readFileSync(
  path.join(process.cwd(), "lib/email/resend.ts"),
  "utf8"
);
const resendCore = fs.readFileSync(
  path.join(process.cwd(), "lib/email/resend-core.ts"),
  "utf8"
);

describe("quote request transactional email contract", () => {
  it("keeps Resend server-only and the secret out of public env variables", () => {
    expect(serverEmail).toContain('import "server-only"');
    expect(serverEmail).toContain("process.env.RESEND_API_KEY");
    expect(serverEmail).not.toContain("NEXT_PUBLIC_RESEND");
    expect(resendCore).not.toContain("RESEND_API_KEY");
  });

  it("wires only successful quote creation to the provider email side effect", () => {
    expect(route).toContain('import { after } from "next/server"');
    expect(route).toContain("sendKlyxProfileTransactionalEmail");
    expect(route).toContain("const emailRequest = request.clone();");
    expect(route).toContain("if (securedResponse.ok)");
    expect(route).toContain("providerProfileId");
    expect(route).toContain('subject: "Nouvelle demande de devis KLYX"');

    const corePostIndex = route.indexOf("const response = await corePost(request)");
    const securedIndex = route.indexOf("const securedResponse", corePostIndex);
    const afterIndex = route.indexOf("after(async () =>", securedIndex);
    const emailIndex = route.indexOf(
      "await sendKlyxProfileTransactionalEmail({",
      afterIndex
    );
    const returnIndex = route.indexOf("return securedResponse;", emailIndex);

    expect(corePostIndex).toBeGreaterThanOrEqual(0);
    expect(securedIndex).toBeGreaterThan(corePostIndex);
    expect(afterIndex).toBeGreaterThan(securedIndex);
    expect(emailIndex).toBeGreaterThan(afterIndex);
    expect(returnIndex).toBeGreaterThan(emailIndex);
  });

  it("keeps email delivery best-effort so quote creation is not failed by Resend", () => {
    expect(serverEmail).toContain("if (!apiKey)");
    expect(serverEmail).toContain("return skippedResult();");
    expect(serverEmail).toContain("catch {");
    expect(serverEmail).toContain("return failedResult();");
    expect(resendCore).toContain("if (!response.ok)");
    expect(resendCore).toContain('status: "failed"');
    expect(route).not.toContain("throw await sendKlyxProfileTransactionalEmail");
  });
});
