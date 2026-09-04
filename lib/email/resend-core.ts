export const KLYX_RESEND_FROM = "KLYX <support@klyx.be>";

export type KlyxEmailDeliveryResult = {
  ok: boolean;
  status: "sent" | "skipped" | "failed";
  provider: "resend";
  httpStatus?: number;
};

type KlyxResendEmailInput = {
  to: string;
  subject: string;
  text: string;
};

type KlyxResendOptions = {
  apiKey?: string | null;
  fetchImpl?: typeof fetch;
};

function skippedResult(): KlyxEmailDeliveryResult {
  return {
    ok: false,
    status: "skipped",
    provider: "resend",
  };
}

export async function sendResendEmail(
  input: KlyxResendEmailInput,
  options: KlyxResendOptions = {}
): Promise<KlyxEmailDeliveryResult> {
  const apiKey = options.apiKey?.trim();
  const to = input.to.trim();
  const subject = input.subject.trim();
  const text = input.text.trim();

  if (!apiKey || !to || !subject || !text) {
    return skippedResult();
  }

  try {
    const response = await (options.fetchImpl ?? fetch)(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: KLYX_RESEND_FROM,
          to: [to],
          subject,
          text,
        }),
      }
    );

    if (!response.ok) {
      return {
        ok: false,
        status: "failed",
        provider: "resend",
        httpStatus: response.status,
      };
    }

    return {
      ok: true,
      status: "sent",
      provider: "resend",
      httpStatus: response.status,
    };
  } catch {
    return {
      ok: false,
      status: "failed",
      provider: "resend",
    };
  }
}
