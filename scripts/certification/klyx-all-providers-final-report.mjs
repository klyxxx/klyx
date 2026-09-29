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

let walNetwork = {
  status: "FAIL",
  provider: "cloudflare-independent-wal",
  mode: "SAFE_CERTIFICATION_WRITE",
  evidence: ["independent WAL report missing"],
};
try {
  walNetwork = JSON.parse(
    fs.readFileSync(path.join(outDir, "independent-wal-network.json"), "utf8")
  );
} catch {
  // Fail-closed below through KLYX_INDEPENDENT_WAL_OUTCOME and this report.
}

const recovery = stepStatus(process.env.KLYX_RECOVERY_OUTCOME);
const repoTests = stepStatus(process.env.KLYX_REPO_TESTS_OUTCOME);
const typescript = stepStatus(process.env.KLYX_TYPESCRIPT_OUTCOME);
const build = stepStatus(process.env.KLYX_BUILD_OUTCOME);
const platforms = stepStatus(process.env.KLYX_PLATFORMS_OUTCOME);
const independentWalStep = stepStatus(process.env.KLYX_INDEPENDENT_WAL_OUTCOME);
const independentWal =
  independentWalStep === "PASS" && walNetwork.status === "PASS" ? "PASS" : "FAIL";
const exactEngine = stepStatus(process.env.KLYX_EXACT_ENGINE_OUTCOME);
const exactStripe = stepStatus(process.env.KLYX_EXACT_STRIPE_OUTCOME);
const exactMobile = stepStatus(process.env.KLYX_EXACT_MOBILE_OUTCOME);
const certSha = process.env.KLYX_CERT_SHA || process.env.GITHUB_SHA || "unknown";

const walEvidence = Array.isArray(walNetwork.evidence)
  ? walNetwork.evidence.join("; ")
  : String(walNetwork.evidence || "independent WAL evidence unavailable");

const providerRows = network.providers.map((item) => {
  if (item.provider === "stripe") {
    return {
      name: item.provider,
      status: item.status === "PASS" && exactStripe === "PASS" ? "PASS" : "FAIL",
      evidence: `${item.evidence}; exact-SHA Economic Chain Stripe TEST=${exactStripe}`,
      mode: item.mode,
    };
  }
  if (item.provider === "cloudflare") {
    return {
      name: item.provider,
      status: item.status === "PASS" && independentWal === "PASS" ? "PASS" : "FAIL",
      evidence: `${item.evidence}; independent Durable Object WAL=${independentWal}; ${walEvidence}`,
      mode: `${item.mode}+SAFE_CERTIFICATION_WRITE`,
    };
  }
  return {
    name: item.provider,
    status: item.status,
    evidence: item.evidence,
    mode: item.mode,
  };
});

const engineStatus =
  repoTests === "PASS" && recovery === "PASS" && exactEngine === "PASS"
    ? "PASS"
    : "FAIL";

const supabaseOutageStatus =
  recovery === "PASS" && independentWal === "PASS" ? "PASS" : "FAIL";

const report = {
  schemaVersion: 4,
  sha: certSha,
  generatedAt: new Date().toISOString(),
  safety: {
    stripeLive: "FORBIDDEN",
    financialLiveMutations: 0,
    providerProbes: "READ_ONLY_OR_SAFE_CERTIFICATION_WRITE_OR_STRIPE_TEST_ONLY",
    independentWalProbeCanonicalSupabaseMutations: 0,
  },
  engines: [
    {
      name: "DEMANDER",
      status: engineStatus,
      chain: "assistant -> matching -> devis -> booking -> Stripe -> mission -> incident -> refund -> closure",
      evidence: `exact-SHA complete-engine=${exactEngine}; repository tests=${repoTests}; recovery=${recovery}`,
    },
    {
      name: "GAGNER",
      status: engineStatus,
      chain: "assistant -> profil -> Twilio -> Sumsub -> eligibility -> opportunite -> mission -> Stripe settlement",
      evidence: `exact-SHA complete-engine=${exactEngine}; repository tests=${repoTests}; recovery=${recovery}`,
    },
  ],
  providers: providerRows,
  platforms: [
    { name: "Web Desktop", status: platforms, evidence: "Chromium Playwright project" },
    { name: "Android Web/PWA", status: platforms, evidence: "Pixel Chromium Playwright emulation" },
    { name: "iOS Web/PWA", status: platforms, evidence: "iPhone WebKit Playwright emulation" },
    {
      name: "Android native",
      status: exactMobile,
      evidence: "exact-SHA KLYX Mobile CI: mobile TypeScript + Expo public config + Android native generation + Core authority boundary",
    },
    {
      name: "iOS native",
      status: exactMobile,
      evidence: "exact-SHA KLYX Mobile CI: iOS native generation on macOS + Core authority boundary",
    },
  ],
  failuresAndRecovery: [
    { scenario: "OpenAI unavailable", status: recovery, strategy: "retry/fallback, no LLM mutation authority" },
    { scenario: "Stripe unavailable", status: recovery === "PASS" && exactStripe === "PASS" ? "PASS" : "FAIL", strategy: "prove-before-replay + bounded retry + reconciliation + exact-SHA Stripe TEST proof" },
    {
      scenario: "Supabase unavailable",
      status: supabaseOutageStatus,
      strategy: `encrypted write-ahead in independent Cloudflare Durable Object before canonical enqueue; alarm/replay reuses the same idempotency key when Supabase returns; deterministic recovery=${recovery}; real independent WAL=${independentWal}`,
    },
    { scenario: "Sumsub unavailable", status: recovery, strategy: "bounded retry; webhook/evidence reconciliation" },
    { scenario: "webhook delayed/absent", status: recovery, strategy: "deduplicate delayed event; recover missing webhook using external evidence" },
    { scenario: "double click/action replay", status: recovery, strategy: "idempotency key + request fingerprint" },
    { scenario: "network cut", status: platforms, strategy: "browser reconnect + durable server workflow recovery" },
    { scenario: "worker crash", status: recovery, strategy: "lease expiry + automatic reclaim/retry" },
    { scenario: "mobile/web resume", status: platforms === "PASS" && exactMobile === "PASS" ? "PASS" : "FAIL", strategy: "Web/PWA reconnect + native client/Core boundary; workflow truth remains server-side" },
  ],
  quality: {
    repoTests,
    typescript,
    build,
    recovery,
    platforms,
    providerNetwork: network.overall,
    independentWal,
    exactEngine,
    exactStripe,
    exactMobile,
  },
};

const hardFailures = [
  ...report.engines.filter((item) => item.status === "FAIL"),
  ...report.providers.filter((item) => item.status === "FAIL"),
  ...report.platforms.filter((item) => item.status === "FAIL"),
  ...report.failuresAndRecovery.filter((item) => item.status === "FAIL"),
  ...(typescript === "FAIL" ? [{ name: "TypeScript" }] : []),
  ...(build === "FAIL" ? [{ name: "build" }] : []),
];
report.overall = hardFailures.length === 0 ? "PASS" : "FAIL";

fs.writeFileSync(
  path.join(outDir, "all-providers-final.json"),
  `${JSON.stringify(report, null, 2)}\n`
);

const lines = [
  "# KLYX All Providers Certification",
  "",
  `- SHA: \`${report.sha}\``,
  `- Overall: **${report.overall}**`,
  "- Stripe LIVE: **FORBIDDEN / 0 LIVE mutations**",
  `- Independent WAL: **${independentWal}**`,
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
