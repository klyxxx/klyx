import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const EXCLUDED_DIRS = new Set([
  ".git",
  ".next",
  "node_modules",
  "coverage",
  "playwright-report",
  "test-results",
]);
const TEXT_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".json",
  ".yml",
  ".yaml",
  ".md",
  ".sql",
  ".env",
  ".toml",
]);
const JS_LIKE_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"]);

const checks = [
  {
    id: "stripe-secret-key",
    severity: "critical",
    description: "Possible Stripe secret key committed to the repository",
    pattern: /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/g,
  },
  {
    id: "stripe-webhook-secret",
    severity: "critical",
    description: "Possible Stripe webhook signing secret committed to the repository",
    pattern: /\bwhsec_[A-Za-z0-9]{16,}\b/g,
  },
  {
    id: "openai-api-key",
    severity: "critical",
    description: "Possible OpenAI API key committed to the repository",
    pattern: /\bsk-(?!live_|test_)[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    id: "supabase-secret-key",
    severity: "critical",
    description: "Possible Supabase secret key committed to the repository",
    pattern: /\bsb_secret_[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    id: "github-token",
    severity: "critical",
    description: "Possible GitHub personal access token committed to the repository",
    pattern: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g,
  },
  {
    id: "private-key",
    severity: "critical",
    description: "Private key material appears to be committed",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  },
  {
    id: "supabase-service-role-client",
    severity: "high",
    description: "SUPABASE_SERVICE_ROLE_KEY referenced from client-facing executable source",
    pattern: /\bSUPABASE_SERVICE_ROLE_KEY\b/g,
    fileFilter(relativePath) {
      const normalized = relativePath.replaceAll("\\", "/");
      const extension = path.extname(normalized).toLowerCase();
      return (
        JS_LIKE_EXTENSIONS.has(extension) &&
        /^(?:app|components|pages|src)\//.test(normalized)
      );
    },
    stripJsComments: true,
  },
  {
    id: "dangerous-eval",
    severity: "medium",
    description: "Dynamic eval() usage should be reviewed",
    pattern: /\beval\s*\(/g,
    fileFilter(relativePath) {
      return JS_LIKE_EXTENSIONS.has(path.extname(relativePath).toLowerCase());
    },
    stripJsComments: true,
  },
];

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === ".env.local" || entry.name === ".env.production.local") {
      continue;
    }

    const absolute = path.join(dir, entry.name);
    const relative = path.relative(ROOT, absolute);

    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) {
        files.push(...(await walk(absolute)));
      }
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (TEXT_EXTENSIONS.has(extension) || entry.name.startsWith(".env")) {
      files.push({ absolute, relative });
    }
  }

  return files;
}

function lineNumber(text, index) {
  return text.slice(0, index).split("\n").length;
}

function stripJavaScriptCommentsPreservingLayout(text) {
  let output = "";
  let index = 0;
  let state = "code";
  let quote = "";

  while (index < text.length) {
    const char = text[index];
    const next = text[index + 1];

    if (state === "line-comment") {
      if (char === "\n") {
        output += "\n";
        state = "code";
      } else {
        output += " ";
      }
      index += 1;
      continue;
    }

    if (state === "block-comment") {
      if (char === "*" && next === "/") {
        output += "  ";
        index += 2;
        state = "code";
      } else {
        output += char === "\n" ? "\n" : " ";
        index += 1;
      }
      continue;
    }

    if (state === "string") {
      output += char;
      if (char === "\\" && index + 1 < text.length) {
        output += text[index + 1];
        index += 2;
        continue;
      }
      if (char === quote) {
        state = "code";
        quote = "";
      }
      index += 1;
      continue;
    }

    if (char === "/" && next === "/") {
      output += "  ";
      index += 2;
      state = "line-comment";
      continue;
    }

    if (char === "/" && next === "*") {
      output += "  ";
      index += 2;
      state = "block-comment";
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      state = "string";
      quote = char;
    }

    output += char;
    index += 1;
  }

  return output;
}

async function main() {
  const findings = [];
  const files = await walk(ROOT);

  for (const file of files) {
    if (file.relative.replaceAll("\\", "/") === "scripts/security/security-audit.mjs") {
      continue;
    }

    let text;
    try {
      text = await fs.readFile(file.absolute, "utf8");
    } catch {
      continue;
    }

    for (const check of checks) {
      if (check.fileFilter && !check.fileFilter(file.relative)) {
        continue;
      }

      const scanText = check.stripJsComments
        ? stripJavaScriptCommentsPreservingLayout(text)
        : text;

      check.pattern.lastIndex = 0;
      for (const match of scanText.matchAll(check.pattern)) {
        findings.push({
          id: check.id,
          severity: check.severity,
          description: check.description,
          file: file.relative.replaceAll("\\", "/"),
          line: lineNumber(scanText, match.index ?? 0),
        });
      }
    }
  }

  const summary = {
    scannedFiles: files.length,
    findings: findings.length,
    critical: findings.filter((item) => item.severity === "critical").length,
    high: findings.filter((item) => item.severity === "high").length,
    medium: findings.filter((item) => item.severity === "medium").length,
  };

  console.log("KLYX Security Engine — repository audit");
  console.log(JSON.stringify(summary, null, 2));

  if (findings.length > 0) {
    for (const finding of findings) {
      console.log(
        `[${finding.severity.toUpperCase()}] ${finding.id} ${finding.file}:${finding.line} — ${finding.description}`
      );
    }
  }

  const blocking = findings.filter(
    (item) => item.severity === "critical" || item.severity === "high"
  );

  if (blocking.length > 0) {
    console.error(`KLYX Security Engine blocked the check with ${blocking.length} high-risk finding(s).`);
    process.exit(1);
  }

  console.log("KLYX Security Engine passed: no critical/high repository findings.");
}

main().catch((error) => {
  console.error("KLYX Security Engine failed unexpectedly.");
  console.error(error);
  process.exit(2);
});