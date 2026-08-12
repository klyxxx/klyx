export type ClientOfferRankingInput = {
  amount: number;
  budgetMax: number | null;
  klyxScore: number;
  rating: number;
  reviewCount: number;
  yearsExperience: number;
  isVerified: boolean;
};

export type ClientOfferRankingResult = {
  score: number;
  reasons: string[];
  priceScore: number;
  trustScore: number;
};

export function calculateClientOfferRanking(
  input: ClientOfferRankingInput
): ClientOfferRankingResult {
  const amount = Math.max(0, Number(input.amount) || 0);
  const budgetMax =
    input.budgetMax === null
      ? null
      : Math.max(0, Number(input.budgetMax) || 0);

  let priceScore = 20;

  if (budgetMax !== null && budgetMax > 0) {
    if (amount <= budgetMax) {
      const ratio = amount / budgetMax;
      priceScore = Math.max(
        10,
        Math.round(30 - ratio * 15)
      );
    } else {
      const overflow = (amount - budgetMax) / budgetMax;
      priceScore = Math.max(
        0,
        Math.round(10 - overflow * 20)
      );
    }
  }

  const normalizedKlyx = Math.max(
    0,
    Math.min(100, Number(input.klyxScore) || 0)
  );

  const klyxComponent = Math.round(
    normalizedKlyx * 0.3
  );

  let trustScore = klyxComponent;
  const reasons: string[] = [];

  if (budgetMax !== null && amount <= budgetMax) {
    reasons.push("Dans ton budget");
  }

  if (
    Number(input.rating) >= 4 &&
    Number(input.reviewCount) > 0
  ) {
    const ratingBonus = Math.min(
      15,
      Math.round(Number(input.rating) * 3)
    );
    trustScore += ratingBonus;

    reasons.push(
      `${Number(input.rating).toFixed(1)}/5 · ${Number(
        input.reviewCount
      )} avis`
    );
  }

  const experience = Math.max(
    0,
    Number(input.yearsExperience) || 0
  );

  if (experience > 0) {
    trustScore += Math.min(
      10,
      Math.round(experience * 1.5)
    );

    reasons.push(
      `${experience} an${experience > 1 ? "s" : ""} d’expérience`
    );
  }

  if (input.isVerified) {
    trustScore += 10;
    reasons.push("Profil vérifié");
  }

  if (normalizedKlyx >= 80) {
    reasons.push(`Score KLYX ${Math.round(normalizedKlyx)}/100`);
  }

  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(priceScore + trustScore)
    )
  );

  return {
    score,
    reasons: reasons.slice(0, 4),
    priceScore,
    trustScore,
  };
}
