import fs from "node:fs";
import path from "node:path";

const root =
  "C:\\Users\\fenjo\\Documents\\klyx";

const backupRoot =
  path.join(
    root,
    ".klyx-local-backup",
    "phase-5c"
  );

fs.mkdirSync(
  backupRoot,
  {
    recursive: true,
  }
);

const files = {
  marketApi:
    "app/api/market/requests/route.ts",

  offersApi:
    "app/api/market/requests/[id]/offers/route.ts",

  jobsApi:
    "app/api/provider/jobs/route.ts",

  jobsPage:
    "app/provider/jobs/page.tsx",

  splitApi:
    "app/api/market/requests/[id]/split-fallback/slot-map/route.ts",

  splitPage:
    "app/assistant/market/[id]/split-plan/page.tsx",

  paymentsPage:
    "app/provider/payments/page.tsx",
};

const originals =
  new Map();

const changed =
  new Map();

function full(relative) {
  return path.join(
    root,
    relative
  );
}

function read(relative) {
  const target =
    full(relative);

  if (!fs.existsSync(target)) {
    throw new Error(
      `Fichier manquant : ${relative}`
    );
  }

  const text =
    fs.readFileSync(
      target,
      "utf8"
    );

  originals.set(
    relative,
    text
  );

  return text;
}

function backup(
  relative,
  content
) {
  const destination =
    path.join(
      backupRoot,
      relative
    );

  fs.mkdirSync(
    path.dirname(
      destination
    ),
    {
      recursive: true,
    }
  );

  fs.writeFileSync(
    destination,
    content,
    "utf8"
  );
}

function replaceRequired(
  text,
  search,
  replacement,
  label
) {
  if (!text.includes(search)) {
    throw new Error(
      `Anchor introuvable : ${label}`
    );
  }

  return text.replace(
    search,
    replacement
  );
}

function replaceRegexRequired(
  text,
  regex,
  replacement,
  label
) {
  if (!regex.test(text)) {
    throw new Error(
      `Pattern introuvable : ${label}`
    );
  }

  regex.lastIndex = 0;

  return text.replace(
    regex,
    replacement
  );
}

function addMarker(
  text,
  marker
) {
  if (
    text.includes(marker)
  ) {
    return text;
  }

  return (
    `${marker}\n` +
    text
  );
}

function matchingParen(
  source,
  openIndex
) {
  let depth = 0;

  let quote = null;
  let escaped = false;

  for (
    let index = openIndex;
    index < source.length;
    index += 1
  ) {
    const char =
      source[index];

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === quote) {
        quote = null;
      }

      continue;
    }

    if (
      char === '"' ||
      char === "'" ||
      char === "`"
    ) {
      quote = char;
      continue;
    }

    if (char === "(") {
      depth += 1;
    }
    else if (
      char === ")"
    ) {
      depth -= 1;

      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function topLevelComma(
  text
) {
  let depth = 0;

  let quote = null;
  let escaped = false;

  for (
    let index = 0;
    index < text.length;
    index += 1
  ) {
    const char =
      text[index];

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === quote) {
        quote = null;
      }

      continue;
    }

    if (
      char === '"' ||
      char === "'" ||
      char === "`"
    ) {
      quote = char;
      continue;
    }

    if (
      char === "(" ||
      char === "[" ||
      char === "{"
    ) {
      depth += 1;
      continue;
    }

    if (
      char === ")" ||
      char === "]" ||
      char === "}"
    ) {
      depth -= 1;
      continue;
    }

    if (
      char === "," &&
      depth === 0
    ) {
      return true;
    }
  }

  return false;
}

function addCurrencyToCalls(
  source,
  callName,
  inferCurrency
) {
  const insertions =
    [];

  let cursor = 0;

  const needle =
    `${callName}(`;

  while (
    cursor <
    source.length
  ) {
    const start =
      source.indexOf(
        needle,
        cursor
      );

    if (start < 0) {
      break;
    }

    const before =
      source.slice(
        Math.max(
          0,
          start - 30
        ),
        start
      );

    if (
      /function\s+$/.test(
        before
      )
    ) {
      cursor =
        start +
        needle.length;

      continue;
    }

    const openIndex =
      start +
      callName.length;

    const closeIndex =
      matchingParen(
        source,
        openIndex
      );

    if (
      closeIndex < 0
    ) {
      throw new Error(
        `Parenthese ${callName} introuvable.`
      );
    }

    const args =
      source.slice(
        openIndex + 1,
        closeIndex
      );

    if (
      !topLevelComma(
        args
      )
    ) {
      const currency =
        inferCurrency(
          args
        );

      if (!currency) {
        throw new Error(
          `Devise impossible a deduire pour ${callName}(${args.slice(0, 100)})`
        );
      }

      insertions.push({
        index:
          closeIndex,

        value:
          `,\n                          ${currency}`,
      });
    }

    cursor =
      closeIndex + 1;
  }

  for (
    const insertion of
    insertions.reverse()
  ) {
    source =
      source.slice(
        0,
        insertion.index
      ) +
      insertion.value +
      source.slice(
        insertion.index
      );
  }

  return source;
}

/*
====================================================
1. MARKET REQUEST API
====================================================
*/

let marketApi =
  read(
    files.marketApi
  );

marketApi =
  addMarker(
    marketApi,
    "// KLYX_MARKET_TRANSACTION_CURRENCY_API_PHASE_5C"
  );

marketApi =
  marketApi.replace(
    /budget_max, status/g,
    "budget_max, country_code, currency, status"
  );

marketApi =
  marketApi.replace(
    /amount, message/g,
    "amount, country_code, currency, message"
  );

if (
  !marketApi.includes(
    "const marketCurrency ="
  )
) {
  marketApi =
    replaceRegexRequired(
      marketApi,
      /\r?\n    if \(\r?\n      !serviceSlug \|\|/,
      `
    const marketCountry =
      profile.countryCode
        .trim()
        .toUpperCase();

    const marketCurrency =
      profile.currencyCode
        .trim()
        .toUpperCase();

    if (
      !/^[A-Z]{2}$/.test(
        marketCountry
      ) ||
      !/^[A-Z]{3}$/.test(
        marketCurrency
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Configure ton pays et ta devise KLYX avant de publier une demande.",
          code:
            "KLYX_PROFILE_MARKET_REQUIRED",
        },
        {
          status: 409,
        }
      );
    }

    if (
      !serviceSlug ||`,
      "market profile currency gate"
    );
}

if (
  !marketApi.includes(
    "country_code: marketCountry"
  )
) {
  marketApi =
    replaceRegexRequired(
      marketApi,
      /          budget_max: budgetMax,\r?\n          status: "open",/,
      `          budget_max: budgetMax,
          country_code: marketCountry,
          currency: marketCurrency,
          status: "open",`,
      "market insert transaction snapshot"
    );
}

if (
  !marketApi.includes(
    "currency: marketCurrency"
  )
) {
  throw new Error(
    "Market API : currency snapshot absent."
  );
}

changed.set(
  files.marketApi,
  marketApi
);

/*
====================================================
2. MARKET OFFERS API
====================================================
*/

let offersApi =
  read(
    files.offersApi
  );

offersApi =
  addMarker(
    offersApi,
    "// KLYX_MARKET_OFFER_TRANSACTION_CURRENCY_PHASE_5C"
  );

offersApi =
  offersApi.replace(
    /id, client_profile_id, service_id, status/g,
    "id, client_profile_id, service_id, country_code, currency, status"
  );

offersApi =
  offersApi.replace(
    /requested_time, request_mode, status, accepted_offer_id/g,
    "requested_time, request_mode, country_code, currency, status, accepted_offer_id"
  );

offersApi =
  offersApi.replace(
    /amount, message, status/g,
    "amount, country_code, currency, message, status"
  );

if (
  !offersApi.includes(
    "country_code: serviceRequest.country_code"
  )
) {
  offersApi =
    replaceRegexRequired(
      offersApi,
      /          user_service_id: userService\.id,\r?\n          amount,/,
      `          user_service_id: userService.id,
          country_code: serviceRequest.country_code,
          currency: serviceRequest.currency,
          amount,`,
      "offer insert currency"
    );

  offersApi =
    replaceRegexRequired(
      offersApi,
      /          market_request_id: requestId,\r?\n          title: serviceRequest\.title,/,
      `          market_request_id: requestId,
          country_code: serviceRequest.country_code,
          currency: serviceRequest.currency,
          title: serviceRequest.title,`,
      "quote inherits market currency"
    );
}

offersApi =
  offersApi.replace(
    /message: `Un prestataire propose \$\{Number\(amount\)\.toFixed\(2\)\} € pour ta demande\.`/,
    'message: `Un prestataire propose ${Number(amount).toFixed(2)} ${serviceRequest.currency} pour ta demande.`'
  );

if (
  !offersApi.includes(
    "currency: serviceRequest.currency"
  )
) {
  throw new Error(
    "Offer API : devise de la demande non propagee."
  );
}

changed.set(
  files.offersApi,
  offersApi
);

/*
====================================================
3. PROVIDER JOBS API
====================================================
*/

let jobsApi =
  read(
    files.jobsApi
  );

jobsApi =
  addMarker(
    jobsApi,
    "// KLYX_PROVIDER_JOBS_CURRENCY_PHASE_5C"
  );

if (
  !jobsApi.includes(
    "  currency:\n    string;"
  ) &&
  !jobsApi.includes(
    "  currency:\r\n    string;"
  )
) {
  jobsApi =
    replaceRegexRequired(
      jobsApi,
      /\r?\n  status:\r?\n    string;/,
      `
  country_code:
    string;

  currency:
    string;

  status:
    string;`,
      "provider jobs BaseRequest currency"
    );
}

changed.set(
  files.jobsApi,
  jobsApi
);

/*
====================================================
4. PROVIDER JOBS UI
====================================================
*/

let jobsPage =
  read(
    files.jobsPage
  );

jobsPage =
  addMarker(
    jobsPage,
    "// KLYX_PROVIDER_JOBS_UI_CURRENCY_PHASE_5C"
  );

if (
  !jobsPage.includes(
    "  currency:\n    string;"
  ) &&
  !jobsPage.includes(
    "  currency:\r\n    string;"
  )
) {
  jobsPage =
    replaceRegexRequired(
      jobsPage,
      /\r?\n  requestMode:/,
      `
  country_code:
    string;

  currency:
    string;

  requestMode:`,
      "provider jobs UI currency type"
    );
}

jobsPage =
  replaceRegexRequired(
    jobsPage,
    /function money\([\s\S]*?\r?\n}\r?\n\r?\nfunction durationLabel\(/,
    `function money(
  value:
    | number
    | null,

  currency:
    string
) {
  if (
    value === null
  ) {
    return "Non precise";
  }

  const code =
    currency
      ?.trim()
      .toUpperCase();

  if (
    !/^[A-Z]{3}$/.test(
      code
    )
  ) {
    return value.toFixed(2);
  }

  return new Intl.NumberFormat(
    "fr-BE",
    {
      style:
        "currency",

      currency:
        code,
    }
  ).format(
    value
  );
}

function durationLabel(`,
    "provider jobs money formatter"
  );

jobsPage =
  addCurrencyToCalls(
    jobsPage,
    "money",
    (
      args
    ) => {
      if (
        args.includes(
          "highestBudget."
        )
      ) {
        return "highestBudget.currency";
      }

      if (
        args.includes(
          "request."
        )
      ) {
        return "request.currency";
      }

      if (
        args.includes(
          "slot."
        )
      ) {
        return "item.currency";
      }

      if (
        args.includes(
          "item."
        )
      ) {
        return "item.currency";
      }

      return null;
    }
  );

if (
  jobsPage.includes(
    "  Euro,"
  )
) {
  if (
    jobsPage.includes(
      "  Banknote,"
    )
  ) {
    jobsPage =
      jobsPage.replace(
        "  Euro,\n",
        ""
      );
  }
  else {
    jobsPage =
      jobsPage.replace(
        "  Euro,",
        "  Banknote,"
      );
  }
}

jobsPage =
  jobsPage.replace(
    /<Euro\b/g,
    "<Banknote"
  );

if (
  /currency:\s*"EUR"/.test(
    jobsPage
  )
) {
  throw new Error(
    "provider/jobs contient encore currency EUR."
  );
}

changed.set(
  files.jobsPage,
  jobsPage
);

/*
====================================================
5. SPLIT SLOT-MAP API
====================================================
*/

let splitApi =
  read(
    files.splitApi
  );

splitApi =
  addMarker(
    splitApi,
    "// KLYX_SPLIT_PLAN_CURRENCY_PHASE_5C"
  );

if (
  !splitApi.includes(
    "const requestCurrency ="
  )
) {
  splitApi =
    replaceRegexRequired(
      splitApi,
      /\r?\n    const ownerId =/,
      `
    const requestCountryCode =
      firstText(
        marketRequest,
        [
          "country_code",
        ]
      ).toUpperCase();

    const requestCurrency =
      firstText(
        marketRequest,
        [
          "currency",
        ]
      ).toUpperCase();

    if (
      !/^[A-Z]{2}$/.test(
        requestCountryCode
      ) ||
      !/^[A-Z]{3}$/.test(
        requestCurrency
      )
    ) {
      return NextResponse.json(
        {
          error:
            "La devise transactionnelle de cette demande KLYX est manquante.",
          code:
            "KLYX_MARKET_CURRENCY_REQUIRED",
        },
        {
          status: 409,
        }
      );
    }

    const ownerId =`,
      "split API market currency extraction"
    );
}

let responseCurrencyCount =
  0;

splitApi =
  splitApi.replace(
    /(NextResponse\.json\(\s*\{\s*\r?\n\s*requestId,\s*\r?\n)/g,
    (
      match
    ) => {
      responseCurrencyCount += 1;

      if (
        match.includes(
          "requestCurrency"
        )
      ) {
        return match;
      }

      return (
        match +
        `
      countryCode:
        requestCountryCode,

      currency:
        requestCurrency,
`
      );
    }
  );

if (
  responseCurrencyCount <
  2 &&
  !splitApi.includes(
    "currency:\n        requestCurrency"
  )
) {
  throw new Error(
    "Split API : reponses currency non trouvees."
  );
}

changed.set(
  files.splitApi,
  splitApi
);

/*
====================================================
6. SPLIT PLAN UI
====================================================
*/

let splitPage =
  read(
    files.splitPage
  );

splitPage =
  addMarker(
    splitPage,
    "// KLYX_SPLIT_PLAN_UI_CURRENCY_PHASE_5C"
  );

if (
  !splitPage.includes(
    "  currency?:"
  )
) {
  splitPage =
    replaceRegexRequired(
      splitPage,
      /\r?\n  slotCount\?:/,
      `
  countryCode?:
    string;

  currency?:
    string;

  slotCount?:`,
      "split response currency type"
    );
}

splitPage =
  replaceRegexRequired(
    splitPage,
    /function formatBudget\([\s\S]*?\r?\n}\r?\n\r?\nexport default function SplitPlanReviewPage/,
    `function formatBudget(
  value:
    number |
    null,

  currency:
    string
): string {
  if (
    value ===
      null ||
    !Number.isFinite(
      value
    )
  ) {
    return "Budget non défini";
  }

  const code =
    currency
      ?.trim()
      .toUpperCase();

  if (
    !/^[A-Z]{3}$/.test(
      code
    )
  ) {
    return value.toFixed(2);
  }

  return new Intl.NumberFormat(
    "fr-BE",
    {
      style:
        "currency",

      currency:
        code,
    }
  ).format(
    value
  );
}

export default function SplitPlanReviewPage`,
    "split formatBudget"
  );

splitPage =
  addCurrencyToCalls(
    splitPage,
    "formatBudget",
    () =>
      'data?.currency ?? ""'
  );

if (
  splitPage.includes(
    "  Euro,"
  )
) {
  if (
    splitPage.includes(
      "  Banknote,"
    )
  ) {
    splitPage =
      splitPage.replace(
        "  Euro,\n",
        ""
      );
  }
  else {
    splitPage =
      splitPage.replace(
        "  Euro,",
        "  Banknote,"
      );
  }
}

splitPage =
  splitPage.replace(
    /<Euro\b/g,
    "<Banknote"
  );

if (
  /currency:\s*"EUR"/.test(
    splitPage
  )
) {
  throw new Error(
    "split-plan contient encore currency EUR."
  );
}

changed.set(
  files.splitPage,
  splitPage
);

/*
====================================================
7. PROVIDER PAYMENTS UI
====================================================
*/

let paymentsPage =
  read(
    files.paymentsPage
  );

paymentsPage =
  addMarker(
    paymentsPage,
    "// KLYX_PROVIDER_PAYMENTS_UI_CURRENCY_PHASE_5C"
  );

paymentsPage =
  replaceRegexRequired(
    paymentsPage,
    /(const EMPTY_SUMMARY:[\s\S]*?\r?\n\s*currency:\s*)"EUR"/,
    '$1""',
    "provider payments empty currency"
  );

paymentsPage =
  replaceRegexRequired(
    paymentsPage,
    /function money\(cents: number, currency = "EUR"\) \{[\s\S]*?\r?\n}\r?\n\r?\nfunction dateTime/,
    `function money(
  cents: number,
  currency: string
) {
  const code =
    currency
      ?.trim()
      .toUpperCase();

  if (
    !/^[A-Z]{3}$/.test(
      code
    )
  ) {
    return (cents / 100).toFixed(2);
  }

  return new Intl.NumberFormat(
    "fr-BE",
    {
      style:
        "currency",
      currency:
        code,
    }
  ).format(
    cents / 100
  );
}

function dateTime`,
    "provider payments money formatter"
  );

if (
  /currency\s*=\s*"EUR"/.test(
    paymentsPage
  ) ||
  /currency:\s*"EUR"/.test(
    paymentsPage
  )
) {
  throw new Error(
    "provider/payments contient encore un fallback EUR."
  );
}

changed.set(
  files.paymentsPage,
  paymentsPage
);

/*
====================================================
8. FINAL STATIC VALIDATION
====================================================
*/

const requiredMarkers = [
  [
    files.marketApi,
    "KLYX_MARKET_TRANSACTION_CURRENCY_API_PHASE_5C",
  ],
  [
    files.offersApi,
    "KLYX_MARKET_OFFER_TRANSACTION_CURRENCY_PHASE_5C",
  ],
  [
    files.jobsApi,
    "KLYX_PROVIDER_JOBS_CURRENCY_PHASE_5C",
  ],
  [
    files.jobsPage,
    "KLYX_PROVIDER_JOBS_UI_CURRENCY_PHASE_5C",
  ],
  [
    files.splitApi,
    "KLYX_SPLIT_PLAN_CURRENCY_PHASE_5C",
  ],
  [
    files.splitPage,
    "KLYX_SPLIT_PLAN_UI_CURRENCY_PHASE_5C",
  ],
  [
    files.paymentsPage,
    "KLYX_PROVIDER_PAYMENTS_UI_CURRENCY_PHASE_5C",
  ],
];

for (
  const [
    relative,
    marker,
  ] of requiredMarkers
) {
  const text =
    changed.get(
      relative
    );

  if (
    !text ||
    !text.includes(
      marker
    )
  ) {
    throw new Error(
      `Validation marker FAILED : ${relative}`
    );
  }
}

if (
  !changed
    .get(
      files.marketApi
    )
    .includes(
      "currency: marketCurrency"
    )
) {
  throw new Error(
    "Market request currency propagation FAILED."
  );
}

if (
  !changed
    .get(
      files.offersApi
    )
    .includes(
      "currency: serviceRequest.currency"
    )
) {
  throw new Error(
    "Offer currency propagation FAILED."
  );
}

if (
  !changed
    .get(
      files.jobsPage
    )
    .includes(
      "currency:\n    string;"
    ) &&
  !changed
    .get(
      files.jobsPage
    )
    .includes(
      "currency:\r\n    string;"
    )
) {
  throw new Error(
    "Provider jobs currency type FAILED."
  );
}

/*
====================================================
9. WRITE ONLY AFTER ALL CHECKS PASS
====================================================
*/

for (
  const [
    relative,
    content,
  ] of changed
) {
  const original =
    originals.get(
      relative
    );

  backup(
    relative,
    original
  );

  fs.writeFileSync(
    full(
      relative
    ),
    content,
    "utf8"
  );
}

console.log("");
console.log(
  "======================================"
);
console.log(
  "KLYX MASTER PHASE 5C APPLIED"
);
console.log(
  "======================================"
);

console.log(
  "Market request currency : SNAPSHOT"
);

console.log(
  "Market offer currency   : INHERITED"
);

console.log(
  "Accepted quote currency : INHERITED"
);

console.log(
  "Provider jobs UI        : DYNAMIC"
);

console.log(
  "Split plan UI           : DYNAMIC"
);

console.log(
  "Provider payments UI    : DYNAMIC"
);

console.log(
  "Silent FX               : NONE"
);

console.log(
  "Backup                  : PRESENT"
);

console.log(
  "======================================"
);