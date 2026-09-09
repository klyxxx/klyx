"use client";

function serviceLabel(value: string) {
  return value.replace(/[-_]+/g, " ").trim();
}

function summarySentence(
  locale: string,
  summary: {
    service: string;
    city: string;
    date: string;
    time: string;
  },
  budget: number | null
) {
  const service = serviceLabel(summary.service);
  const budgetPart =
    budget == null
      ? ""
      : locale === "en"
        ? `, budget up to €${budget.toFixed(2)}`
        : `, budget max ${budget.toFixed(2)} €`;

  if (locale === "en") {
    return `I understand: ${service} in ${summary.city}, ${summary.date} at ${summary.time}${budgetPart}. I can search now.`;
  }

  if (locale === "nl") {
    return `Ik heb het begrepen: ${service} in ${summary.city}, ${summary.date} om ${summary.time}${budgetPart}. Ik kan nu zoeken.`;
  }

  if (locale === "de") {
    return `Ich habe verstanden: ${service} in ${summary.city}, ${summary.date} um ${summary.time}${budgetPart}. Ich kann jetzt suchen.`;
  }

  return `J’ai compris : ${service} à ${summary.city}, le ${summary.date} à ${summary.time}${budgetPart}. Je peux chercher maintenant.`;
}

export default function ReadyForSearchSummary({
  locale,
  summary,
  budget,
}: {
  locale: string;
  summary: {
    service: string;
    city: string;
    date: string;
    time: string;
  };
  budget: number | null;
}) {
  return (
    <div
      data-testid="ready-for-search-summary"
      className="max-w-[92%] border-l-2 border-[#2563EB] py-1 pl-4 text-sm leading-7 text-foreground sm:max-w-[82%]"
    >
      <p>{summarySentence(locale, summary, budget)}</p>
    </div>
  );
}
