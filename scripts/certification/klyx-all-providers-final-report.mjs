import fs from "node:fs";
import path from "node:path";

const outDir = path.join(process.cwd(), "reports", "certification");
fs.mkdirSync(outDir, { recursive: true });

function stepStatus(value) {
  return value === "success" ? "PASS" : "FAIL";
}

let network = { overall: "FAIL", providers: [] };
try {
  network = JSON.parse(
    fs.readFileSync(path.join(outDir, "all-providers-network.json"), "utf8")
  );
} catch {
  network = {
    overall: "FAIL",
    providers: [
      {
        provider: "provider-network-report",
        status: "FAIL",
        mode: "CERTIFICATION",
        evidence: "network report missing",
      },
    ],
  };
}

const recovery = stepStatus(process.env.KLYX_RECOVERY_OUTCOME);
const repoTests = stepStatus(process.env.KLYX_REPO_TESTS_OUTCOME);
const typescript = stepStatus(process.env.KLYX_TYPESCRIPT_OUTCOME);
const build = stepStatus(process.env.KLYX_BUILD_OUTCOME);
const platforms = stepStatus(process.env.KLYX_PLATFORMS_OUTCOME);

const providerRows = network.providers.map((item) => ({
  name: item.provider,
  status: item.status,
  evidence: item.evidence,
  mode: item.mode,
}));

const report = {
  schemaVersion: 1,
  sha: process.env.GITHUB_SHA || "unknown",
  generatedAt: new Date().toISOString(),
  safety: {
    stripeLive: "FORBIDDEN",
    financialLiveMutations: 0,
    providerProbes: "READ_ONLY_OR_STRIPE_TEST_ONLY",
  },
  engines: [
    {
      name: "DEMANDER",
      status: repoTests === "PASS" && recovery === "PASS" ? "PASS" : "FAIL",
      chain: "assistant -> matching -> devis -> booking -> Stripe -> mission -> incident -> refund -> closure",
      evidence: "repository test suite + dedicated recovery certification; complete-engine workflow is a separate required check",
    },
    {
      name: "GAGNER",
      status: repoTests === "PASS" && recovery === "PASS" ? "PASS" : "FAIL",
      chain: "assistant -> profil -> Twilio -> Sumsub -> eligibility -> opportunite -> mission -> Stripe settlement",
      evidence: "repository test suite + dedicated recovery certification; external providers are reported independently",
    },
  ],
  providers: providerRows,
  platforms: [
    { name: "Web Desktop", status: platforms, evidence: "Chromium Playwright project" },
    { name: "Android Web", status: platforms, evidence: "Pixel Chromium Playwright emulation" },
    { name: "iOS Web", status: platforms, evidence: "iPhone WebKit Playwright emulation" },
    {
      name: "Android native",
      status: "NOT_IMPLEMENTED",
      evidence: "repository is Next.js Web; no native Android runtime is certified",
    },
    {
      name: "iOS native",
      status: "NOT_IMPLEMENTED",
      evidence: "repository is Next.js Web; no native iOS runtime is certified",
    },
  ],
  failuresAndRecovery: [
    { scenario: "OpenAI unavailable", status: recovery, strategy: "retry/fallback, no LLM mutation authority" },
    { scenario: "Stripe unavailable", status: recovery, strategy: "prove-before-replay + bounded retry + reconciliation" },
    {
      scenario: "Supabase unavailable",
      status: "FAIL",
      strategy: "fail-closed; canonical durable queue is in Supabase, so total Supabase outage has no independent write-ahead durability domain",
    },
    { scenario: "Sumsub unavailable", status: recovery, strategy: "bounded retry; webhook/evidence reconciliation" },
    { scenario: "webhook delayed/absent", status: recovery, strategy: "deduplicate delayed event; recover missing webhook using external evidence" },
    { scenario: "double click/action replay", status: recovery, strategy: "idempotency key + request fingerprint" },
    { scenario: "network cut", status: platforms, strategy: "browser reconnect + durable server workflow recovery" },
    { scenario: "worker crash", status: recovery, strategy: "lease expiry + automatic reclaim/retry" },
    { scenario: "mobile/web resume", status: platforms, strategy: "platform browser restart/network resume; workflow truth remains server-side" },
  ],
  quality: { repoTests, typescript, build, recovery, platforms, providerNetwork: network.overall },
};

const hardFailures = [
  ...report.engines.filter((item) => item.status === "FAIL"),
  ...report.providers.filter((item) => item.status === "FAIL"),
  ...report.failuresAndRecovery.filter((item) => item.status === "FAIL"),
  ...(typescript === "FAIL" ? [{ name: "TypeScript" }] : []),
  ...(build === "FAIL" ? [{ name: "build" }] : []),
];
report.overall = hardFailures.length === 0 ? "PASS" : "FAIL";

const jsonPath = path.join(outDir, "all-providers-final.json");
fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

const lines = [
  "# KLYX All Providers Certification",
  "",
  `- SHA: \`${report.sha}\``,
  `- Overall: **${report.overall}**`,
  "- Stripe LIVE: **FORBIDDEN / 0 LIVE mutations**",
  "",
  "## Engines",
  "",
  "| Engine | Status | Evidence |",
  "|---|---|---|",
  ...report.engines.map((row) => `| ${row.name} | ${row.status} | ${row.evidence} |`),
  "",
  "## Providers",
  "",
  "| Provider | Status | Mode | Evidence |",
  "|---|---|---|---|",
  ...report.providers.map((row) => `| ${row.name} | ${row.status} | ${row.mode} | ${String(row.evidence).replace(/\|/g, "\\|")} |`),
  "",
  "## Platforms",
  "",
  "| Platform | Status | Evidence |",
  "|---|---|---|",
  ...report.platforms.map((row) => `| ${row.name} | ${row.status} | ${row.evidence} |`),
  "",
  "## Failure recovery",
  "",
  "| Scenario | Status | Strategy |",
  "|---|---|---|",
  ...report.failuresAndRecovery.map((row) => `| ${row.scenario} | ${row.status} | ${row.strategy} |`),
  "",
];
fs.writeFileSync(path.join(outDir, "all-providers-final.md"), `${lines.join("\n")}\n`);
console.log(lines.join("\n"));

if (report.overall !== "PASS") process.exitCode = 1;
