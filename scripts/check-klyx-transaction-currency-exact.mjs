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

  const text =
    fs.readFileSync(
      filePath,
      "utf8"
    );

  for (
    const rawLine of
    text.split(/\r?\n/)
  ) {
    const line =
      rawLine.trim();

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

    result[key] =
      value;
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
    "Configuration Supabase manquante."
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

async function columnExists(
  table,
  column
) {
  const {
    error,
  } =
    await supabase
      .from(table)
      .select(
        `id, ${column}`
      )
      .limit(1);

  return {
    table,
    column,
    exists:
      !error,
    errorCode:
      error?.code ?? null,
  };
}

async function valueStats(
  table,
  column
) {
  const {
    data,
    error,
  } =
    await supabase
      .from(table)
      .select(column)
      .limit(1000);

  if (error) {
    return {
      available:
        false,
      total:
        0,
      nulls:
        0,
      values:
        [],
    };
  }

  const rows =
    data ?? [];

  const values =
    rows
      .map(
        (row) =>
          row[column]
      )
      .filter(
        (value) =>
          typeof value === "string" &&
          value.trim() !== ""
      )
      .map(
        (value) =>
          value.trim().toUpperCase()
      );

  return {
    available:
      true,
    total:
      rows.length,
    nulls:
      rows.length -
      values.length,
    values:
      Array.from(
        new Set(
          values
        )
      ).sort(),
  };
}

const checks = [
  ["profiles", "country_code"],
  ["profiles", "currency_code"],

  ["service_quotes", "country_code"],
  ["service_quotes", "currency"],
  ["service_quotes", "currency_code"],

  ["bookings", "country_code"],
  ["bookings", "currency"],
  ["bookings", "currency_code"],

  ["booking_groups", "country_code"],
  ["booking_groups", "currency"],
  ["booking_groups", "currency_code"],

  ["market_service_requests", "country_code"],
  ["market_service_requests", "currency"],
  ["market_service_requests", "currency_code"],

  ["market_service_offers", "country_code"],
  ["market_service_offers", "currency"],
  ["market_service_offers", "currency_code"],
];

console.log("");
console.log(
  "======================================"
);
console.log(
  "KLYX EXACT TRANSACTION CURRENCY AUDIT"
);
console.log(
  "======================================"
);

const results = [];

for (
  const [
    table,
    column,
  ] of checks
) {
  const result =
    await columnExists(
      table,
      column
    );

  results.push(
    result
  );

  console.log(
    `${table}.${column} = ${
      result.exists
        ? "PRESENT"
        : "MISSING"
    }`
  );
}

console.log("");
console.log(
  "======================================"
);
console.log(
  "EXISTING TRANSACTION VALUES"
);
console.log(
  "======================================"
);

for (
  const [
    table,
    column,
  ] of [
    ["profiles", "currency_code"],
    ["profiles", "country_code"],
    ["service_quotes", "currency"],
    ["service_quotes", "country_code"],
    ["bookings", "currency"],
    ["bookings", "country_code"],
    ["booking_groups", "currency"],
    ["booking_groups", "country_code"],
  ]
) {
  const exists =
    results.find(
      (item) =>
        item.table === table &&
        item.column === column
    )?.exists === true;

  if (!exists) {
    console.log(
      `${table}.${column} = COLUMN_MISSING`
    );

    continue;
  }

  const stats =
    await valueStats(
      table,
      column
    );

  console.log(
    `${table}.${column}`
  );

  console.log(
    `  rows  : ${stats.total}`
  );

  console.log(
    `  nulls : ${stats.nulls}`
  );

  console.log(
    `  values: ${
      stats.values.length > 0
        ? stats.values.join(", ")
        : "NONE"
    }`
  );
}

function exists(
  table,
  column
) {
  return (
    results.find(
      (item) =>
        item.table === table &&
        item.column === column
    )?.exists === true
  );
}

console.log("");
console.log(
  "======================================"
);
console.log(
  "KLYX TRANSACTION MODEL CLASSIFICATION"
);
console.log(
  "======================================"
);

const quoteCurrency =
  exists(
    "service_quotes",
    "currency"
  );

const bookingCurrency =
  exists(
    "bookings",
    "currency"
  );

const quoteCountry =
  exists(
    "service_quotes",
    "country_code"
  );

const bookingCountry =
  exists(
    "bookings",
    "country_code"
  );

const groupCountry =
  exists(
    "booking_groups",
    "country_code"
  );

const marketRequestCurrency =
  exists(
    "market_service_requests",
    "currency"
  );

const marketOfferCurrency =
  exists(
    "market_service_offers",
    "currency"
  );

console.log(
  `quote transaction currency : ${quoteCurrency}`
);

console.log(
  `booking transaction currency : ${bookingCurrency}`
);

console.log(
  `quote transaction country : ${quoteCountry}`
);

console.log(
  `booking transaction country : ${bookingCountry}`
);

console.log(
  `group transaction country : ${groupCountry}`
);

console.log(
  `market request currency : ${marketRequestCurrency}`
);

console.log(
  `market offer currency : ${marketOfferCurrency}`
);

if (
  quoteCurrency &&
  bookingCurrency &&
  quoteCountry &&
  bookingCountry &&
  groupCountry &&
  !marketRequestCurrency &&
  !marketOfferCurrency
) {
  console.log("");
  console.log(
    "DECISION = APPLY_MARKET_CURRENCY_EXTENSION_ONLY"
  );
}
else if (
  quoteCurrency &&
  bookingCurrency &&
  !marketRequestCurrency &&
  !marketOfferCurrency
) {
  console.log("");
  console.log(
    "DECISION = APPLY_14_23_AND_MARKET_EXTENSION"
  );
}
else {
  console.log("");
  console.log(
    "DECISION = REVIEW_TRANSACTION_SCHEMA_BEFORE_WRITE"
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
  "KLYX EXACT TRANSACTION CURRENCY AUDIT COMPLETE"
);
console.log(
  "======================================"
);