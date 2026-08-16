import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = "C:\\Users\\fenjo\\Documents\\klyx";

function readEnvFile(filePath) {
  const result = {};

  if (!fs.existsSync(filePath)) {
    return result;
  }

  const text = fs.readFileSync(filePath, "utf8");

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const index = line.indexOf("=");

    if (index <= 0) {
      continue;
    }

    const key = line.slice(0, index).trim();

    let value = line
      .slice(index + 1)
      .trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

const env = {
  ...process.env,
  ...readEnvFile(
    path.join(root, ".env.local")
  ),
};

const url =
  env.NEXT_PUBLIC_SUPABASE_URL;

const serviceRole =
  env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRole) {
  throw new Error(
    "Supabase URL/service role manquant."
  );
}

const supabase =
  createClient(
    url,
    serviceRole,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

async function probe(
  table,
  columns
) {
  const {
    data,
    error,
  } =
    await supabase
      .from(table)
      .select(columns)
      .limit(1);

  return {
    table,
    columns,
    ok: !error,
    errorCode:
      error?.code ?? null,
    errorMessage:
      error?.message ?? null,
    rowCount:
      data?.length ?? 0,
  };
}

console.log("");
console.log(
  "======================================"
);
console.log(
  "KLYX MARKET CURRENCY LIVE AUDIT"
);
console.log(
  "======================================"
);

const probes = [];

probes.push(
  await probe(
    "market_service_requests",
    "id, currency_code"
  )
);

probes.push(
  await probe(
    "market_service_offers",
    "id, request_id, currency_code"
  )
);

probes.push(
  await probe(
    "market_service_request_slots",
    "id, market_request_id, budget_max"
  )
);

probes.push(
  await probe(
    "service_quotes",
    "id, currency_code"
  )
);

probes.push(
  await probe(
    "bookings",
    "id, currency_code"
  )
);

for (const item of probes) {
  console.log("");
  console.log(
    `${item.table}`
  );

  console.log(
    `  query        : ${item.columns}`
  );

  console.log(
    `  column check : ${
      item.ok
        ? "PASS"
        : "FAIL"
    }`
  );

  console.log(
    `  rows read    : ${item.rowCount}`
  );

  if (item.errorCode) {
    console.log(
      `  error code   : ${item.errorCode}`
    );
  }

  if (item.errorMessage) {
    console.log(
      `  error        : ${item.errorMessage}`
    );
  }
}

console.log("");
console.log(
  "======================================"
);
console.log(
  "LOCAL SQL SCAN"
);
console.log(
  "======================================"
);

const sqlFiles = [];

function walk(directory) {
  if (!fs.existsSync(directory)) {
    return;
  }

  for (
    const entry of
    fs.readdirSync(
      directory,
      {
        withFileTypes: true,
      }
    )
  ) {
    const full =
      path.join(
        directory,
        entry.name
      );

    if (entry.isDirectory()) {
      walk(full);
      continue;
    }

    if (
      entry.isFile() &&
      entry.name.endsWith(".sql")
    ) {
      sqlFiles.push(full);
    }
  }
}

walk(
  path.join(
    root,
    "supabase"
  )
);

for (
  const target of [
    "market_service_requests",
    "market_service_offers",
    "service_quotes",
    "bookings",
  ]
) {
  let found = 0;

  console.log("");
  console.log(
    `TABLE: ${target}`
  );

  for (
    const file of
    sqlFiles
  ) {
    const text =
      fs.readFileSync(
        file,
        "utf8"
      );

    if (
      text.includes(target) &&
      /currency_code/i.test(text)
    ) {
      found += 1;

      console.log(
        "  " +
        path.relative(
          root,
          file
        )
      );
    }
  }

  console.log(
    `  SQL currency signals: ${found}`
  );
}

console.log("");
console.log(
  "======================================"
);
console.log(
  "CLASSIFICATION"
);
console.log(
  "======================================"
);

const requestProbe =
  probes.find(
    (item) =>
      item.table ===
      "market_service_requests"
  );

const offerProbe =
  probes.find(
    (item) =>
      item.table ===
      "market_service_offers"
  );

if (
  requestProbe?.ok &&
  offerProbe?.ok
) {
  console.log(
    "MARKET CURRENCY MODEL = PRESENT"
  );

  console.log(
    "NEXT = brancher API + UI sur currency_code existant."
  );
}
else if (
  !requestProbe?.ok &&
  !offerProbe?.ok
) {
  console.log(
    "MARKET CURRENCY MODEL = MISSING"
  );

  console.log(
    "NEXT = migration transaction currency + API + UI."
  );
}
else {
  console.log(
    "MARKET CURRENCY MODEL = PARTIAL"
  );

  console.log(
    "NEXT = completer le snapshot de devise avant l'UI."
  );
}

console.log("");
console.log(
  "READ ONLY = TRUE"
);
console.log(
  "======================================"
);
console.log(
  "KLYX MARKET CURRENCY LIVE AUDIT COMPLETE"
);
console.log(
  "======================================"
);