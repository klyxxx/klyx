import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const root =
  "C:\\Users\\fenjo\\Documents\\klyx";

function readEnv(filePath) {
  const result = {};

  if (!fs.existsSync(filePath)) {
    return result;
  }

  for (
    const raw of
    fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
  ) {
    const line = raw.trim();

    if (
      !line ||
      line.startsWith("#")
    ) {
      continue;
    }

    const index =
      line.indexOf("=");

    if (index <= 0) {
      continue;
    }

    const key =
      line
        .slice(0, index)
        .trim();

    let value =
      line
        .slice(index + 1)
        .trim();

    if (
      (
        value.startsWith('"') &&
        value.endsWith('"')
      ) ||
      (
        value.startsWith("'") &&
        value.endsWith("'")
      )
    ) {
      value =
        value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

const env = {
  ...process.env,
  ...readEnv(
    path.join(
      root,
      ".env.local"
    )
  ),
};

const supabaseUrl =
  env.NEXT_PUBLIC_SUPABASE_URL;

const serviceRole =
  env.SUPABASE_SERVICE_ROLE_KEY;

if (
  !supabaseUrl ||
  !serviceRole
) {
  throw new Error(
    "Variables Supabase manquantes."
  );
}

const supabase =
  createClient(
    supabaseUrl,
    serviceRole,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

async function columnProbe(
  table,
  columns
) {
  const {
    error,
  } =
    await supabase
      .from(table)
      .select(columns)
      .limit(1);

  return {
    table,
    columns,
    ok:
      !error,
    error:
      error?.message ?? null,
  };
}

async function countRows(
  table
) {
  const {
    count,
    error,
  } =
    await supabase
      .from(table)
      .select(
        "*",
        {
          count: "exact",
          head: true,
        }
      );

  return {
    table,
    count:
      count ?? null,
    ok:
      !error,
    error:
      error?.message ?? null,
  };
}

console.log("");
console.log(
  "======================================"
);
console.log(
  "LIVE PROFILE MARKET COLUMNS"
);
console.log(
  "======================================"
);

const profileProbe =
  await columnProbe(
    "profiles",
    "id, country_code, currency_code"
  );

console.log(
  `profiles country/currency = ${
    profileProbe.ok
      ? "PASS"
      : "FAIL"
  }`
);

if (profileProbe.error) {
  console.log(
    `error = ${profileProbe.error}`
  );
}

console.log("");
console.log(
  "======================================"
);
console.log(
  "TABLE ROW COUNTS"
);
console.log(
  "======================================"
);

const tables = [
  "profiles",
  "market_service_requests",
  "market_service_offers",
  "service_quotes",
  "bookings",
  "market_service_request_slots",
];

const counts = [];

for (const table of tables) {
  const result =
    await countRows(
      table
    );

  counts.push(
    result
  );

  console.log(
    `${table} = ${
      result.ok
        ? result.count
        : "ERROR"
    }`
  );

  if (result.error) {
    console.log(
      `  ${result.error}`
    );
  }
}

console.log("");
console.log(
  "======================================"
);
console.log(
  "RELATIONSHIP COLUMN CHECKS"
);
console.log(
  "======================================"
);

const relationshipProbes = [
  [
    "market_service_requests",
    "id, client_profile_id, budget_max",
  ],
  [
    "market_service_offers",
    "id, request_id, provider_profile_id, amount",
  ],
  [
    "service_quotes",
    "id, client_profile_id, provider_profile_id",
  ],
  [
    "bookings",
    "id, parent_id, provider_id, babysitter_id",
  ],
];

const relations = [];

for (
  const [
    table,
    columns,
  ] of relationshipProbes
) {
  const result =
    await columnProbe(
      table,
      columns
    );

  relations.push(
    result
  );

  console.log(
    `${table} = ${
      result.ok
        ? "PASS"
        : "FAIL"
    }`
  );

  if (result.error) {
    console.log(
      `  ${result.error}`
    );
  }
}

console.log("");
console.log(
  "======================================"
);
console.log(
  "MIGRATION SAFETY CLASSIFICATION"
);
console.log(
  "======================================"
);

const profileReady =
  profileProbe.ok;

const hasData =
  counts.some(
    (item) =>
      item.ok &&
      typeof item.count === "number" &&
      item.count > 0 &&
      item.table !== "profiles"
  );

const relationsReady =
  relations.every(
    (item) =>
      item.ok
  );

console.log(
  `profiles currency ready : ${profileReady}`
);

console.log(
  `existing transactional data : ${hasData}`
);

console.log(
  `relationship columns ready : ${relationsReady}`
);

if (
  !profileReady
) {
  console.log(
    "DECISION = STOP_PROFILE_MARKET_MIGRATION_MISSING"
  );
}
else if (
  hasData &&
  !relationsReady
) {
  console.log(
    "DECISION = STOP_BACKFILL_RELATIONS_UNKNOWN"
  );
}
else if (
  hasData
) {
  console.log(
    "DECISION = SAFE_TO_PREPARE_IDEMPOTENT_BACKFILL"
  );
}
else {
  console.log(
    "DECISION = SAFE_TO_PREPARE_EMPTY_TABLE_MIGRATION"
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
  "KLYX PHASE 5A AUDIT COMPLETE"
);
console.log(
  "======================================"
);