export const KLYX_EMAIL_BRAND = {
  name: "KLYX",
  blue: "#2563EB",
  supportEmail: "support@klyx.be",
  homeUrl: "https://klyx.be",
} as const;

export type KlyxEmailContent = {
  subject: string;
  text: string;
  html: string;
};

type KlyxEmailDetail = {
  label: string;
  value: string;
};

type KlyxEmailTemplateInput = {
  subject: string;
  preheader: string;
  headline: string;
  paragraphs: string[];
  ctaLabel: string;
  ctaUrl: string;
  details?: KlyxEmailDetail[];
  note?: string;
};

export function escapeEmailHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function klyxEmailUrl(path = "/"): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, KLYX_EMAIL_BRAND.homeUrl).toString();
}

function renderPlainText(input: KlyxEmailTemplateInput): string {
  const details = (input.details ?? [])
    .map((detail) => `${detail.label} : ${detail.value}`)
    .join("\n");

  return [
    KLYX_EMAIL_BRAND.name,
    "",
    input.headline,
    "",
    ...input.paragraphs,
    details ? `\n${details}` : "",
    "",
    `${input.ctaLabel} : ${input.ctaUrl}`,
    input.note ? `\n${input.note}` : "",
    "",
    `Besoin d’aide ? ${KLYX_EMAIL_BRAND.supportEmail}`,
    KLYX_EMAIL_BRAND.homeUrl,
    "",
    "KLYX ne vous demandera jamais votre mot de passe par email.",
  ]
    .filter((line, index, lines) => {
      if (line !== "") return true;
      return index === 0 || lines[index - 1] !== "";
    })
    .join("\n")
    .trim();
}

function renderDetails(details: KlyxEmailDetail[]): string {
  if (details.length === 0) return "";

  const rows = details
    .map(
      (detail) => `
        <tr>
          <td style="padding:8px 12px 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#6B7280;vertical-align:top;white-space:nowrap;">${escapeEmailHtml(detail.label)}</td>
          <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:#111111;font-weight:600;vertical-align:top;">${escapeEmailHtml(detail.value)}</td>
        </tr>`
    )
    .join("");

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;background:#F7F7F7;border:1px solid #E5E7EB;border-radius:14px;">
      <tr>
        <td style="padding:14px 18px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${rows}
          </table>
        </td>
      </tr>
    </table>`;
}

export function renderKlyxEmail(
  input: KlyxEmailTemplateInput
): KlyxEmailContent {
  const safeSubject = input.subject.trim();
  const safePreheader = escapeEmailHtml(input.preheader.trim());
  const safeHeadline = escapeEmailHtml(input.headline.trim());
  const safeCtaLabel = escapeEmailHtml(input.ctaLabel.trim());
  const safeCtaUrl = escapeEmailHtml(input.ctaUrl.trim());
  const paragraphs = input.paragraphs
    .filter((paragraph) => paragraph.trim())
    .map(
      (paragraph) => `
        <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:26px;color:#333333;">${escapeEmailHtml(paragraph.trim())}</p>`
    )
    .join("");
  const details = renderDetails(input.details ?? []);
  const note = input.note?.trim()
    ? `<p style="margin:22px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#6B7280;">${escapeEmailHtml(input.note.trim())}</p>`
    : "";

  const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeEmailHtml(safeSubject)}</title>
</head>
<body style="margin:0;padding:0;background:#F5F5F5;color:#111111;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${safePreheader}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#F5F5F5;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:20px;overflow:hidden;">
          <tr>
            <td style="padding:30px 34px 18px;font-family:Arial,Helvetica,sans-serif;">
              <div style="font-size:22px;line-height:28px;font-weight:800;letter-spacing:1.8px;color:#111111;">KLYX</div>
              <div style="margin-top:12px;width:42px;height:4px;border-radius:999px;background:${KLYX_EMAIL_BRAND.blue};font-size:0;line-height:0;">&nbsp;</div>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 34px 34px;">
              <h1 style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:28px;line-height:36px;font-weight:750;letter-spacing:-0.4px;color:#111111;">${safeHeadline}</h1>
              ${paragraphs}
              ${details}
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:26px 0 0;">
                <tr>
                  <td bgcolor="${KLYX_EMAIL_BRAND.blue}" style="border-radius:12px;">
                    <a href="${safeCtaUrl}" style="display:inline-block;padding:13px 20px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:20px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:12px;background:${KLYX_EMAIL_BRAND.blue};">${safeCtaLabel}</a>
                  </td>
                </tr>
              </table>
              ${note}
            </td>
          </tr>
          <tr>
            <td style="padding:22px 34px 28px;border-top:1px solid #EEEEEE;font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0 0 8px;font-size:12px;line-height:18px;color:#6B7280;">Besoin d’aide ? <a href="mailto:${KLYX_EMAIL_BRAND.supportEmail}" style="color:#111111;text-decoration:underline;">${KLYX_EMAIL_BRAND.supportEmail}</a></p>
              <p style="margin:0 0 8px;font-size:12px;line-height:18px;color:#6B7280;"><a href="${KLYX_EMAIL_BRAND.homeUrl}" style="color:#111111;text-decoration:underline;">klyx.be</a></p>
              <p style="margin:0;font-size:11px;line-height:17px;color:#9CA3AF;">Cet email concerne une action effectuée sur votre compte KLYX. KLYX ne vous demandera jamais votre mot de passe par email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    subject: safeSubject,
    text: renderPlainText(input),
    html,
  };
}
