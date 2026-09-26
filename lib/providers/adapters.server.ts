import "server-only";

import type { KlyxLlmProvider } from "@/lib/brain/llm/contracts";
import {
  getKlyxLlmProvider,
  getKlyxLlmStatus,
} from "@/lib/brain/llm/provider";
import {
  isKlyxElmahIoConfigured,
} from "@/lib/elmah-io";
import {
  sendKlyxProfileTransactionalEmail,
  sendKlyxTransactionalEmail,
} from "@/lib/email/resend";
import {
  createSumsubSdkToken,
  sumsubConfigured,
} from "@/lib/sumsub";
import {
  inspectStripeRuntime,
} from "@/lib/stripe-runtime";
import {
  sendPhoneOtp,
  verifyPhoneOtp,
} from "@/lib/twilio-verify";
import {
  getKlyxProviderDescriptor,
} from "./catalog";
import type {
  KlyxEmailDeliveryProvider,
  KlyxIdentityVerificationProvider,
  KlyxPhoneVerificationProvider,
  KlyxProviderAdapter,
  KlyxProviderStatus,
} from "./contracts";

function present(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

function exactSha(value: string | undefined): boolean {
  return /^[0-9a-f]{40}$/i.test(value?.trim() ?? "");
}

function status(
  id: KlyxProviderStatus["id"],
  configured: boolean,
  productionReady: boolean,
  detail: string
): KlyxProviderStatus {
  return { id, configured, productionReady, detail };
}

export const openAiProviderAdapter: KlyxProviderAdapter & {
  getProvider(): KlyxLlmProvider;
} = {
  descriptor: getKlyxProviderDescriptor("openai"),
  getStatus() {
    const llm = getKlyxLlmStatus();
    return status(
      "openai",
      llm.configured,
      llm.available,
      llm.available
        ? `LLM provider available (${llm.model ?? "configured model"}).`
        : "External LLM unavailable; deterministic KLYX fallback remains active."
    );
  },
  getProvider() {
    return getKlyxLlmProvider();
  },
};

export const supabaseProviderAdapter: KlyxProviderAdapter = {
  descriptor: getKlyxProviderDescriptor("supabase"),
  getStatus() {
    const publicConfigured =
      present("NEXT_PUBLIC_SUPABASE_URL") &&
      (present("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ||
        present("NEXT_PUBLIC_SUPABASE_ANON_KEY"));
    const privilegedConfigured =
      present("SUPABASE_SECRET_KEY") ||
      present("SUPABASE_SERVICE_ROLE_KEY");
    const configured = publicConfigured && privilegedConfigured;

    return status(
      "supabase",
      configured,
      configured,
      configured
        ? "Publishable/RLS browser boundary and server authority credentials are configured."
        : "Supabase requires both a public RLS-bound configuration and server-only privileged authority."
    );
  },
};

export const stripeProviderAdapter: KlyxProviderAdapter = {
  descriptor: getKlyxProviderDescriptor("stripe"),
  getStatus() {
    try {
      const runtime = inspectStripeRuntime();
      return status(
        "stripe",
        runtime.checks.some((check) => check.key === "secret_key" && check.ok),
        runtime.ready,
        `mode=${runtime.mode}; livePaymentsEnabled=${runtime.livePaymentsEnabled}; external execution remains subordinate to KLYX financial authority.`
      );
    } catch {
      return status(
        "stripe",
        false,
        false,
        "Stripe runtime mode is not fully configured. No financial authority is inferred from provider configuration."
      );
    }
  },
};

export const sumsubProviderAdapter: KlyxIdentityVerificationProvider = {
  descriptor: getKlyxProviderDescriptor("sumsub"),
  getStatus() {
    const configured = sumsubConfigured();
    return status(
      "sumsub",
      configured,
      configured,
      configured
        ? "Server signing credentials, level and webhook verification are configured."
        : "Identity provider configuration is incomplete; KLYX must not treat identity as verified."
    );
  },
  async createSessionToken(input) {
    const result = await createSumsubSdkToken({
      userId: input.subjectId,
      email: input.email,
    });

    return {
      token: result.token,
      externalUserId: result.userId,
    };
  },
};

export const twilioProviderAdapter: KlyxPhoneVerificationProvider = {
  descriptor: getKlyxProviderDescriptor("twilio"),
  getStatus() {
    const credentials =
      (present("TWILIO_API_KEY_SID") && present("TWILIO_API_KEY_SECRET")) ||
      (present("TWILIO_ACCOUNT_SID") && present("TWILIO_AUTH_TOKEN"));
    const configured = credentials && present("TWILIO_VERIFY_SERVICE_SID");

    return status(
      "twilio",
      configured,
      configured,
      configured
        ? "Twilio Verify server credentials and service are configured."
        : "Twilio Verify configuration is incomplete."
    );
  },
  async sendCode(phoneNumber) {
    await sendPhoneOtp(phoneNumber);
  },
  async verifyCode(phoneNumber, code) {
    return verifyPhoneOtp(phoneNumber, code);
  },
};

export const resendProviderAdapter: KlyxEmailDeliveryProvider = {
  descriptor: getKlyxProviderDescriptor("resend"),
  getStatus() {
    const configured = present("RESEND_API_KEY");
    return status(
      "resend",
      configured,
      configured,
      configured
        ? "Transactional email credential is configured server-side."
        : "Transactional email is disabled; business state must continue without assuming delivery."
    );
  },
  sendTransactional(input) {
    return sendKlyxTransactionalEmail(input);
  },
  sendProfileTransactional(input) {
    return sendKlyxProfileTransactionalEmail(input);
  },
};

export const tolgeeProviderAdapter: KlyxProviderAdapter = {
  descriptor: getKlyxProviderDescriptor("tolgee"),
  getStatus() {
    return status(
      "tolgee",
      true,
      true,
      "Production runtime uses committed translation snapshots; Tolgee network availability is not required for rendering."
    );
  },
};

export const turnstileProviderAdapter: KlyxProviderAdapter = {
  descriptor: getKlyxProviderDescriptor("turnstile"),
  getStatus() {
    const configured = present("NEXT_PUBLIC_TURNSTILE_SITE_KEY");
    return status(
      "turnstile",
      configured,
      process.env.VERCEL_ENV !== "production" || configured,
      configured
        ? "Public site key is configured; verification secret remains managed by the authentication authority."
        : "Turnstile public site key is missing. Production auth must not silently bypass anti-abuse checks."
    );
  },
};

export const elmahProviderAdapter: KlyxProviderAdapter = {
  descriptor: getKlyxProviderDescriptor("elmah"),
  getStatus() {
    const configured = isKlyxElmahIoConfigured();
    return status(
      "elmah",
      configured,
      true,
      configured
        ? "Production telemetry is configured with bounded fail-open delivery."
        : "Remote telemetry is unavailable; structured KLYX server logging remains the fallback."
    );
  },
};

export const vercelProviderAdapter: KlyxProviderAdapter = {
  descriptor: getKlyxProviderDescriptor("vercel"),
  getStatus() {
    const production = process.env.VERCEL_ENV === "production";
    const provenance = exactSha(process.env.VERCEL_GIT_COMMIT_SHA);
    return status(
      "vercel",
      Boolean(process.env.VERCEL_ENV),
      !production || provenance,
      production && provenance
        ? "Production runtime exposes exact deployment SHA provenance."
        : production
          ? "Production runtime is missing exact deployment SHA provenance."
          : "Vercel production runtime is not active in this process."
    );
  },
};

export const githubProviderAdapter: KlyxProviderAdapter = {
  descriptor: getKlyxProviderDescriptor("github"),
  getStatus() {
    const provenance =
      exactSha(process.env.GITHUB_SHA) ||
      exactSha(process.env.VERCEL_GIT_COMMIT_SHA);
    return status(
      "github",
      provenance,
      provenance,
      provenance
        ? "Git commit provenance is available to the runtime/control plane."
        : "GitHub control-plane connectivity cannot be proven from this process."
    );
  },
};

export const KLYX_PROVIDER_ADAPTERS = {
  openai: openAiProviderAdapter,
  supabase: supabaseProviderAdapter,
  stripe: stripeProviderAdapter,
  sumsub: sumsubProviderAdapter,
  twilio: twilioProviderAdapter,
  resend: resendProviderAdapter,
  tolgee: tolgeeProviderAdapter,
  turnstile: turnstileProviderAdapter,
  elmah: elmahProviderAdapter,
  vercel: vercelProviderAdapter,
  github: githubProviderAdapter,
} as const;
