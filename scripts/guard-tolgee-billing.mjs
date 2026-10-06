const approved = process.env.KLYX_TOLGEE_BILLING_APPROVED?.trim() === "1";
const guarded = process.env.KLYX_EXTERNAL_COST_MODE?.trim().toLowerCase() === "guarded";

if (!approved || !guarded) {
  console.error(
    [
      "KLYX Tolgee push blocked.",
      "Tolgee Free is not an unlimited-billing guarantee: exceeding the hosted-word tier can trigger a paid plan upgrade.",
      "Use committed catalogs for zero-cost development.",
      "If a real cloud push is intentionally approved, set:",
      "  KLYX_EXTERNAL_COST_MODE=guarded",
      "  KLYX_TOLGEE_BILLING_APPROVED=1",
    ].join("\n"),
  );
  process.exit(1);
}

console.log("KLYX Tolgee push billing guard: APPROVED");
