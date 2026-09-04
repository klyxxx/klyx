import { describe, expect, it } from "vitest";

import {
  KLYX_EMAIL_BRAND,
  escapeEmailHtml,
  renderKlyxEmail,
} from "../../lib/email/klyx-email-template";
import {
  bookingRequestedEmail,
  paymentFailedEmail,
  quoteRequestedEmail,
  quoteSentEmail,
  refundConfirmedEmail,
} from "../../lib/email/templates";

describe("KLYX professional email templates", () => {
  it("uses the KLYX visual identity and professional support footer", () => {
    const email = quoteRequestedEmail();

    expect(email.subject).toBe("Nouvelle demande de devis sur KLYX");
    expect(email.text).toContain("support@klyx.be");
    expect(email.text).toContain("https://klyx.be");
    expect(email.html).toContain("#2563EB");
    expect(email.html).toContain("support@klyx.be");
    expect(email.html).toContain("klyx.be");
    expect(email.html).toContain("Voir la demande");
    expect(KLYX_EMAIL_BRAND.blue).toBe("#2563EB");
  });

  it("keeps a meaningful plain-text fallback for clients without HTML", () => {
    const email = quoteSentEmail("quote-123");

    expect(email.text).toContain("Votre devis est arrivé");
    expect(email.text).toContain("Consulter le devis");
    expect(email.text).toContain("https://klyx.be/quotes/quote-123");
    expect(email.text).toContain(
      "KLYX ne vous demandera jamais votre mot de passe par email."
    );
  });

  it("escapes dynamic values before rendering them into HTML", () => {
    const email = bookingRequestedEmail({
      bookingId: "booking-1",
      service: '<img src=x onerror="alert(1)">',
      bookingDate: "2026-09-12",
      startTime: "10:00",
      endTime: "12:00",
    });

    expect(escapeEmailHtml("<script>alert('x')</script>")).toBe(
      "&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;"
    );
    expect(email.html).not.toContain("<img src=x");
    expect(email.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("renders transaction notices as one clear action instead of marketing mail", () => {
    const failed = paymentFailedEmail("booking-2");
    const refund = refundConfirmedEmail("booking-2");

    expect(failed.subject).toBe("Votre paiement KLYX n’a pas abouti");
    expect(failed.html).toContain("Vérifier la réservation");
    expect(refund.subject).toBe("Votre remboursement est confirmé");
    expect(refund.html).toContain("Voir la réservation");
    expect(failed.html.match(/<a href=/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("renders arbitrary paragraphs safely in the shared shell", () => {
    const email = renderKlyxEmail({
      subject: "Test KLYX",
      preheader: "Prévisualisation",
      headline: "Bonjour <KLYX>",
      paragraphs: ["Une phrase & une autre."],
      ctaLabel: "Ouvrir KLYX",
      ctaUrl: "https://klyx.be",
    });

    expect(email.html).toContain("Bonjour &lt;KLYX&gt;");
    expect(email.html).toContain("Une phrase &amp; une autre.");
    expect(email.text).toContain("Bonjour <KLYX>");
  });
});
