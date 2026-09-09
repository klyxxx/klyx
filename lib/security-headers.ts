export type KlyxSecurityHeadersOptions = {
  production: boolean;
  supabaseUrl?: string | null;
};

export const KLYX_TURNSTILE_ORIGIN =
  "https://challenges.cloudflare.com";
export const KLYX_SUMSUB_ORIGIN = "https://api.sumsub.com";

const HSTS_VALUE = "max-age=31536000";
const PERMISSIONS_POLICY_VALUE =
  `camera=(self \"${KLYX_SUMSUB_ORIGIN}\"), ` +
  `microphone=(self \"${KLYX_SUMSUB_ORIGIN}\"), ` +
  "geolocation=(), payment=(), usb=()";

function normalizeHttpOrigin(value: string | null | undefined) {
  const raw = value?.trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function toWebSocketOrigin(httpOrigin: string) {
  const url = new URL(httpOrigin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.origin;
}

function joinSources(values: string[]) {
  return [...new Set(values)].join(" ");
}

export function buildKlyxContentSecurityPolicy(
  options: KlyxSecurityHeadersOptions
) {
  const supabaseOrigin = normalizeHttpOrigin(options.supabaseUrl);
  const scriptSources = [
    "'self'",
    "'unsafe-inline'",
    KLYX_TURNSTILE_ORIGIN,
  ];

  if (!options.production) {
    // Next.js development tooling requires eval for source maps / Fast Refresh.
    scriptSources.push("'unsafe-eval'");
  }

  const connectSources = [
    "'self'",
    KLYX_TURNSTILE_ORIGIN,
    KLYX_SUMSUB_ORIGIN,
  ];
  const imageSources = ["'self'", "data:", "blob:"];

  if (supabaseOrigin) {
    connectSources.push(supabaseOrigin, toWebSocketOrigin(supabaseOrigin));
    imageSources.push(supabaseOrigin);
  }

  const directives = [
    `default-src 'self'`,
    `script-src ${joinSources(scriptSources)}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src ${joinSources(imageSources)}`,
    `font-src 'self'`,
    `connect-src ${joinSources(connectSources)}`,
    `frame-src ${KLYX_TURNSTILE_ORIGIN} ${KLYX_SUMSUB_ORIGIN}`,
    `worker-src 'self'`,
    `manifest-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
  ];

  if (options.production) {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}

export function buildKlyxSecurityHeaders(
  options: KlyxSecurityHeadersOptions
): Array<{ key: string; value: string }> {
  const headers = [
    {
      key: "Content-Security-Policy",
      value: buildKlyxContentSecurityPolicy(options),
    },
    {
      key: "X-Content-Type-Options",
      value: "nosniff",
    },
    {
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    },
    {
      key: "Permissions-Policy",
      value: PERMISSIONS_POLICY_VALUE,
    },
    {
      key: "X-Frame-Options",
      value: "DENY",
    },
  ];

  if (options.production) {
    headers.push({
      key: "Strict-Transport-Security",
      value: HSTS_VALUE,
    });
  }

  return headers;
}
