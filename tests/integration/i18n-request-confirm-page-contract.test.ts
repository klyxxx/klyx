import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = fs.readFileSync(
  path.join(process.cwd(), "app/request/confirm/page.tsx"),
  "utf8"
);

describe("KLYX request confirm page contract", () => {
  it("remains navigation-only with no backend mutation or payment action", () => {
    expect(pageSource).not.toContain("fetch(");
    expect(pageSource).not.toContain("method: \"POST\"");
    expect(pageSource).not.toContain("method: \"PATCH\"");
    expect(pageSource).not.toContain("method: \"DELETE\"");
    expect(pageSource).not.toContain("/api/");
    expect(pageSource).not.toContain("stripe");
    expect(pageSource).not.toContain("checkout");
  });

  it("preserves Brussels temporal safeguards", () => {
    expect(pageSource).toContain("todayInBrussels()");
    expect(pageSource).toContain("minimumFutureTimeForDate(request.date)");
    expect(pageSource).toContain("isPastBookingStart(request.date, request.time)");
    expect(pageSource).toContain("request.date < minimumDate");
  });

  it("preserves confirmation proof identifiers", () => {
    expect(pageSource).toContain('searchParams.get("conversationId")');
    expect(pageSource).toContain('searchParams.get("confirmationId")');
    expect(pageSource).toContain('params.set("conversationId", conversationId)');
    expect(pageSource).toContain('params.set("confirmationId", confirmationId)');
  });

  it("preserves the exact recommendations navigation fields", () => {
    for (const field of ["service", "city", "date", "time"]) {
      expect(pageSource).toContain(`params.set(\"${field}\"`);
    }
    expect(pageSource).toContain('params.set("budget", request.budget)');
    expect(pageSource).toContain(
      "router.push(`/recommendations?${params.toString()}`)"
    );
  });

  it("keeps budget optional and never invents a negative value", () => {
    expect(pageSource).toContain("request.budget && Number(request.budget) >= 0");
    expect(pageSource).toContain('min="0"');
    expect(pageSource).toContain('step="0.01"');
  });

  it("localizes presentation through the dedicated helper", () => {
    expect(pageSource).toContain("useKlyxLocale()");
    expect(pageSource).toContain("translateKlyxRequestConfirm(locale, key)");
    expect(pageSource).toContain("formatKlyxRequestConfirmService(locale, request.service)");
    expect(pageSource).not.toContain("const serviceLabels");
  });
});
