import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const reportDir = path.join(root, "reports", "integrated-financial-test-48");
const inputPath = path.join(reportDir, "vitest.json");
const markdownPath = path.join(reportDir, "summary.md");
const proofPath = path.join(reportDir, "proof.json");

fs.mkdirSync(reportDir, { recursive: true });

const scenarios = [
  "success",
  "failed_payment",
  "failed_transfer",
  "timeout",
  "duplicate_webhook",
  "late_webhook",
  "missing_webhook",
  "retry",
  "double_click",
  "partial_refund",
  "full_refund",
  "reversal",
];
const topologies = ["single", "group", "split", "multi_provider"];
const expectedKeys = new Set(
  topologies.flatMap((topology) =>
    scenarios.map((scenario) => `${topology}:${scenario}`)
  )
);

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return {
      __readError:
        error instanceof Error ? error.message : "KLYX_CERT_TEST_REPORT_READ_FAILED",
    };
  }
}

function assertionsFrom(report) {
  const rows = [];
  for (const suite of Array.isArray(report?.testResults) ? report.testResults : []) {
    for (const assertion of Array.isArray(suite?.assertionResults)
      ? suite.assertionResults
      : []) {
      rows.push(assertion);
    }
  }
  return rows;
}

const report = readJson(inputPath);
const cells = [];
const seen = new Set();

for (const assertion of assertionsFrom(report)) {
  const fullName = String(assertion?.fullName ?? assertion?.title ?? "");
  const topologyMatch = fullName.match(/topology=(single|group|split|multi_provider)/);
  const scenarioMatch = fullName.match(
    /scenario=(success|failed_payment|failed_transfer|timeout|duplicate_webhook|late_webhook|missing_webhook|retry|double_click|partial_refund|full_refund|reversal)/
  );
  if (!topologyMatch || !scenarioMatch) continue;

  const topology = topologyMatch[1];
  const scenario = scenarioMatch[1];
  const key = `${topology}:${scenario}`;
  if (seen.has(key)) continue;
  seen.add(key);

  const rawStatus = String(assertion?.status ?? "unknown").toLowerCase();
  const status = rawStatus === "passed" ? "PASS" : "FAIL";
  const failureMessages = Array.isArray(assertion?.failureMessages)
    ? assertion.failureMessages.map(String)
    : [];

  cells.push({
    topology,
    scenario,
    status,
    failureMessages,
  });
}

for (const key of expectedKeys) {
  if (seen.has(key)) continue;
  const [topology, scenario] = key.split(":");
  cells.push({
    topology,
    scenario,
    status: "FAIL",
    failureMessages: ["KLYX_CERT_TEST_CELL_MISSING"],
  });
}

cells.sort((left, right) => {
  const topologyOrder = topologies.indexOf(left.topology) - topologies.indexOf(right.topology);
  if (topologyOrder !== 0) return topologyOrder;
  return scenarios.indexOf(left.scenario) - scenarios.indexOf(right.scenario);
});

const passCount = cells.filter((cell) => cell.status === "PASS").length;
const failCount = cells.filter((cell) => cell.status === "FAIL").length;
const complete = cells.length === 48 && passCount === 48 && failCount === 0;
const sha = String(process.env.GITHUB_SHA ?? process.env.KLYX_EXPECTED_SHA ?? "").trim();
const deployedSha = String(process.env.KLYX_DEPLOYED_SHA ?? "").trim();
const productionUrl = String(process.env.KLYX_PRODUCTION_URL ?? "").trim();

const proof = {
  version: 1,
  scope: "integrated_financial_test_48",
  generatedAt: new Date().toISOString(),
  sha,
  deployedSha,
  productionUrl,
  liveMoneyMovement: false,
  stripeMode: "simulated_test",
  requiredCellCount: 48,
  observedCellCount: cells.length,
  passCount,
  failCount,
  status: complete ? "PASS" : "FAIL",
  invariant: "KLYX Ledger = Settlement truth = Stripe truth",
  divergencePolicy: "block -> reconciliation -> human_review",
  cells,
  reportReadError: report?.__readError ?? null,
};

fs.writeFileSync(proofPath, `${JSON.stringify(proof, null, 2)}\n`, "utf8");

const lines = [
  "# KLYX Integrated Financial TEST 48",
  "",
  `- Status: **${proof.status}**`,
  `- SHA: \`${sha || "unknown"}\``,
  `- Deployed SHA: \`${deployedSha || "not-checked-in-this-run"}\``,
  `- Stripe mode: \`simulated_test\``,
  "- LIVE money movement: **false**",
  `- Matrix: **${passCount}/48 PASS**`,
  "",
  "| Topology | Scenario | Result |",
  "| --- | --- | --- |",
  ...cells.map(
    (cell) => `| ${cell.topology} | ${cell.scenario} | ${cell.status} |`
  ),
  "",
  "Invariant:",
  "",
  "```text",
  "KLYX Ledger = Settlement truth = Stripe truth",
  "```",
  "",
  "Divergence:",
  "",
  "```text",
  "block -> reconciliation -> human_review",
  "```",
  "",
];

fs.writeFileSync(markdownPath, `${lines.join("\n")}\n`, "utf8");

process.stdout.write(
  `KLYX Integrated Financial TEST 48: ${proof.status} (${passCount}/48 PASS)\n`
);

if (!complete) process.exitCode = 1;
