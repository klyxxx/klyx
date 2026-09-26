export const KLYX_REQUIRED_PROVIDER_CERTIFICATION = [
  "stripe",
  "twilio",
  "sumsub",
  "tolgee",
  "resend",
  "supabase",
  "cloudflare",
  "elmah.io",
  "openai",
] as const;

export const KLYX_REQUIRED_PLATFORM_CERTIFICATION = [
  "web-desktop",
  "android-web",
  "ios-web",
] as const;

export const KLYX_REQUIRED_FAILURE_CERTIFICATION = [
  "openai_unavailable",
  "stripe_unavailable",
  "supabase_unavailable",
  "sumsub_unavailable",
  "delayed_webhook",
  "double_click",
  "network_cut",
  "worker_crash",
  "mobile_web_resume",
] as const;

export const KLYX_CERTIFICATION_SAFETY = Object.freeze({
  stripeLiveAllowed: false,
  providerNetworkMutationsAllowed: false,
  humanReviewPolicy: "automatic_recovery_first_then_fail_closed_review",
});
