import "server-only";

// KLYX_MULTI_SLOT_BRAIN_12_82

export type BrainScheduleDaypart =
  | "morning"
  | "afternoon"
  | "evening"
  | "night"
  | "noon"
  | null;

export type BrainScheduleSlot = {
  id: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  daypart: BrainScheduleDaypart;
  exactTimeRange: boolean;
  budget: number | null;
  durationHours: number | null;
  maxHourlyRate: number | null;
  source: string;
};

export type BrainMultiSlotSchedule = {
  multiSlot: true;
  slots: BrainScheduleSlot[];
  sharedBudget: boolean;
  needsExactTimes: boolean;
  readyForMatching: boolean;
  publicationProtected: true;
  totals: {
    slotCount: number;
    knownHours: number;
    totalHours: number | null;
    hoursComplete: boolean;
    knownBudgetTotal: number;
    totalBudget: number | null;
    budgetComplete: boolean;
  };
};

type ParseOptions = {
  fallbackBudget?: number | null;
};

type DateMention = {
  index: number;
  value: string;
};

type ParsedTime = {
  startTime: string | null;
  endTime: string | null;
  daypart: BrainScheduleDaypart;
  exactTimeRange: boolean;
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9€\s:/.,-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function roundHours(value: number) {
  return Math.round(value * 100) / 100;
}

function isoDateFromUtc(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(
    date.getUTCMonth() + 1
  ).padStart(2, "0");
  const day = String(
    date.getUTCDate()
  ).padStart(2, "0");

  return (
    String(year) +
    "-" +
    month +
    "-" +
    day
  );
}

function brusselsTodayDate() {
  const formatter =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone:
          "Europe/Brussels",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    );

  const parts =
    formatter.formatToParts(
      new Date()
    );

  const year = Number(
    parts.find(
      (item) =>
        item.type === "year"
    )?.value
  );

  const month = Number(
    parts.find(
      (item) =>
        item.type === "month"
    )?.value
  );

  const day = Number(
    parts.find(
      (item) =>
        item.type === "day"
    )?.value
  );

  return new Date(
    Date.UTC(
      year,
      month - 1,
      day
    )
  );
}

function addDays(
  date: Date,
  days: number
) {
  const result =
    new Date(date.getTime());

  result.setUTCDate(
    result.getUTCDate() +
      days
  );

  return result;
}

function resolveDateReference(
  value: string
): string | null {
  const normalized =
    normalize(value);

  const today =
    brusselsTodayDate();

  if (
    normalized.includes(
      "aujourd hui"
    ) ||
    normalized ===
      "aujourdhui"
  ) {
    return isoDateFromUtc(
      today
    );
  }

  if (
    normalized.includes(
      "apres demain"
    ) ||
    normalized.includes(
      "apresdemain"
    )
  ) {
    return isoDateFromUtc(
      addDays(today, 2)
    );
  }

  if (
    normalized === "demain" ||
    normalized.includes(
      "demain"
    )
  ) {
    return isoDateFromUtc(
      addDays(today, 1)
    );
  }

  const weekdayMap:
    Record<string, number> = {
      dimanche: 0,
      lundi: 1,
      mardi: 2,
      mercredi: 3,
      jeudi: 4,
      vendredi: 5,
      samedi: 6,
    };

  for (
    const [weekday, target]
    of Object.entries(
      weekdayMap
    )
  ) {
    if (
      normalized.includes(
        weekday
      )
    ) {
      const current =
        today.getUTCDay();

      let daysAhead =
        (
          target -
          current +
          7
        ) % 7;

      if (
        daysAhead === 0
      ) {
        daysAhead = 7;
      }

      return isoDateFromUtc(
        addDays(
          today,
          daysAhead
        )
      );
    }
  }

  const numeric =
    normalized.match(
      /\b(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?\b/
    );

  if (!numeric) {
    return null;
  }

  const day =
    Number(numeric[1]);

  const month =
    Number(numeric[2]);

  let year =
    numeric[3]
      ? Number(numeric[3])
      : today.getUTCFullYear();

  if (year < 100) {
    year += 2000;
  }

  const result =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  if (
    result.getUTCFullYear() !==
      year ||
    result.getUTCMonth() !==
      month - 1 ||
    result.getUTCDate() !==
      day
  ) {
    return null;
  }

  return isoDateFromUtc(
    result
  );
}

function findDateMentions(
  text: string
): DateMention[] {
  const expression =
    /(après\s*-?\s*demain|apres\s*-?\s*demain|aujourd(?:\s|['’])*hui|aujourdhui|demain|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|\b\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?\b)/giu;

  const result:
    DateMention[] = [];

  for (
    const match
    of text.matchAll(
      expression
    )
  ) {
    if (
      match.index == null ||
      !match[0]
    ) {
      continue;
    }

    result.push({
      index: match.index,
      value: match[0],
    });
  }

  return result;
}

function clock(
  hours: number,
  minutes: number
) {
  if (
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return (
    String(hours).padStart(
      2,
      "0"
    ) +
    ":" +
    String(minutes).padStart(
      2,
      "0"
    )
  );
}

function parseTimeRange(
  text: string
): ParsedTime | null {
  const value =
    normalize(text);

  const match =
    value.match(
      /(?:de\s+|entre\s+)?(\d{1,2})\s*(?:h|:)\s*(\d{0,2})\s*(?:a|jusqu a|jusqua|-)\s*(\d{1,2})\s*(?:h|:)\s*(\d{0,2})/
    );

  if (!match) {
    return null;
  }

  const start =
    clock(
      Number(match[1]),
      Number(
        match[2] || "0"
      )
    );

  const end =
    clock(
      Number(match[3]),
      Number(
        match[4] || "0"
      )
    );

  if (
    !start ||
    !end
  ) {
    return null;
  }

  return {
    startTime: start,
    endTime: end,
    daypart: null,
    exactTimeRange: true,
  };
}

function parseDaypart(
  text: string
): ParsedTime {
  const value =
    normalize(text);

  if (
    value.includes(
      "matin"
    )
  ) {
    return {
      startTime: "09:00",
      endTime: null,
      daypart: "morning",
      exactTimeRange: false,
    };
  }

  if (
    value.includes(
      "apres midi"
    )
  ) {
    return {
      startTime: "14:00",
      endTime: null,
      daypart: "afternoon",
      exactTimeRange: false,
    };
  }

  if (
    value.includes(
      "soir"
    ) ||
    value.includes(
      "soiree"
    )
  ) {
    return {
      startTime: "18:00",
      endTime: null,
      daypart: "evening",
      exactTimeRange: false,
    };
  }

  if (
    value.includes(
      "nuit"
    )
  ) {
    return {
      startTime: "20:00",
      endTime: null,
      daypart: "night",
      exactTimeRange: false,
    };
  }

  if (
    value.includes(
      "midi"
    )
  ) {
    return {
      startTime: "12:00",
      endTime: null,
      daypart: "noon",
      exactTimeRange: false,
    };
  }

  const timeMatch =
    value.match(
      /\b(\d{1,2})\s*(?:h|:)\s*(\d{0,2})\b/
    );

  if (timeMatch) {
    const start =
      clock(
        Number(
          timeMatch[1]
        ),
        Number(
          timeMatch[2] ||
            "0"
        )
      );

    return {
      startTime: start,
      endTime: null,
      daypart: null,
      exactTimeRange: false,
    };
  }

  return {
    startTime: null,
    endTime: null,
    daypart: null,
    exactTimeRange: false,
  };
}

function parseTime(
  text: string
): ParsedTime {
  return (
    parseTimeRange(text) ??
    parseDaypart(text)
  );
}

function timeToMinutes(
  value: string
) {
  const match =
    value.match(
      /^(\d{2}):(\d{2})$/
    );

  if (!match) {
    return null;
  }

  return (
    Number(match[1]) *
      60 +
    Number(match[2])
  );
}

function calculateDuration(
  startTime: string | null,
  endTime: string | null
) {
  if (
    !startTime ||
    !endTime
  ) {
    return null;
  }

  const start =
    timeToMinutes(
      startTime
    );

  const end =
    timeToMinutes(
      endTime
    );

  if (
    start == null ||
    end == null
  ) {
    return null;
  }

  let minutes =
    end - start;

  if (
    minutes <= 0
  ) {
    minutes +=
      24 * 60;
  }

  if (
    minutes <= 0 ||
    minutes > 24 * 60
  ) {
    return null;
  }

  return roundHours(
    minutes / 60
  );
}

function parseBudget(
  text: string
) {
  const euro =
    text.match(
      /(\d+(?:[.,]\d{1,2})?)\s*(?:€|euros?|eur)\b/i
    );

  if (euro) {
    const amount =
      Number(
        euro[1].replace(
          ",",
          "."
        )
      );

    if (
      Number.isFinite(
        amount
      ) &&
      amount >= 0
    ) {
      return roundMoney(
        amount
      );
    }
  }

  const value =
    normalize(text);

  const budget =
    value.match(
      /(?:budget|maximum|max)\s*(?:de|a|:)?\s*(\d+(?:[.,]\d{1,2})?)/
    );

  if (!budget) {
    return null;
  }

  const amount =
    Number(
      budget[1].replace(
        ",",
        "."
      )
    );

  if (
    !Number.isFinite(
      amount
    ) ||
    amount < 0
  ) {
    return null;
  }

  return roundMoney(
    amount
  );
}

function hasSharedBudgetPhrase(
  text: string
) {
  const value =
    normalize(text);

  return [
    "meme budget",
    "budget identique",
    "meme montant",
    "chaque creneau",
    "par creneau",
    "chacun",
    "comme d habitude",
    "pareil pour les deux",
  ].some(
    (expression) =>
      value.includes(
        expression
      )
  );
}

function globalSharedBudget(
  text: string
) {
  const value =
    normalize(text);

  const match =
    value.match(
      /(?:meme budget|budget identique|meme montant)\s*(?:de|a|:)?\s*(\d+(?:[.,]\d{1,2})?)\s*(?:€|euros?|eur)?/
    );

  if (!match) {
    return null;
  }

  const amount =
    Number(
      match[1].replace(
        ",",
        "."
      )
    );

  if (
    !Number.isFinite(
      amount
    ) ||
    amount < 0
  ) {
    return null;
  }

  return roundMoney(
    amount
  );
}

function daypartLabel(
  value: BrainScheduleDaypart
) {
  if (
    value === "morning"
  ) {
    return "matin";
  }

  if (
    value === "afternoon"
  ) {
    return "apres-midi";
  }

  if (
    value === "evening"
  ) {
    return "soir";
  }

  if (
    value === "night"
  ) {
    return "nuit";
  }

  if (
    value === "noon"
  ) {
    return "midi";
  }

  return null;
}

function money(
  value: number
) {
  return (
    value.toFixed(2) +
    " EUR"
  );
}

function hours(
  value: number
) {
  return (
    value.toFixed(2) +
    " h"
  );
}

export function parseMultiSlotSchedule(
  text: string,
  options: ParseOptions = {}
): BrainMultiSlotSchedule | null {
  const mentions =
    findDateMentions(text);

  if (
    mentions.length < 2
  ) {
    return null;
  }

  const sharedBudget =
    hasSharedBudgetPhrase(
      text
    );

  const sharedAmount =
    globalSharedBudget(
      text
    ) ??
    (
      sharedBudget &&
      options.fallbackBudget != null
        ? roundMoney(
            options.fallbackBudget
          )
        : null
    );

  const slots:
    BrainScheduleSlot[] = [];

  for (
    let index = 0;
    index <
    mentions.length;
    index += 1
  ) {
    const mention =
      mentions[index];

    const next =
      mentions[index + 1];

    const segment =
      text
        .slice(
          mention.index,
          next
            ? next.index
            : text.length
        )
        .trim();

    const date =
      resolveDateReference(
        mention.value
      );

    if (!date) {
      continue;
    }

    const parsedTime =
      parseTime(
        segment
      );

    const durationHours =
      calculateDuration(
        parsedTime.startTime,
        parsedTime.endTime
      );

    const directBudget =
      parseBudget(
        segment
      );

    slots.push({
      id:
        "slot-" +
        String(
          slots.length + 1
        ),
      date,
      startTime:
        parsedTime.startTime,
      endTime:
        parsedTime.endTime,
      daypart:
        parsedTime.daypart,
      exactTimeRange:
        parsedTime.exactTimeRange,
      budget:
        directBudget ??
        sharedAmount,
      durationHours,
      maxHourlyRate:
        directBudget != null &&
        durationHours != null &&
        durationHours > 0
          ? roundMoney(
              directBudget /
                durationHours
            )
          : sharedAmount != null &&
              durationHours != null &&
              durationHours > 0
            ? roundMoney(
                sharedAmount /
                  durationHours
              )
            : null,
      source:
        segment.slice(
          0,
          300
        ),
    });
  }

  if (
    slots.length < 2
  ) {
    return null;
  }

  if (sharedBudget) {
    const firstKnownBudget =
      sharedAmount ??
      slots.find(
        (slot) =>
          slot.budget != null
      )?.budget ??
      null;

    if (
      firstKnownBudget != null
    ) {
      for (
        const slot
        of slots
      ) {
        if (
          slot.budget == null
        ) {
          slot.budget =
            firstKnownBudget;

          if (
            slot.durationHours != null &&
            slot.durationHours > 0
          ) {
            slot.maxHourlyRate =
              roundMoney(
                firstKnownBudget /
                  slot.durationHours
              );
          }
        }
      }
    }
  }

  const knownHours =
    roundHours(
      slots.reduce(
        (total, slot) =>
          total +
          (
            slot.durationHours ??
            0
          ),
        0
      )
    );

  const hoursComplete =
    slots.every(
      (slot) =>
        slot.durationHours != null
    );

  const knownBudgetTotal =
    roundMoney(
      slots.reduce(
        (total, slot) =>
          total +
          (
            slot.budget ??
            0
          ),
        0
      )
    );

  const budgetComplete =
    slots.every(
      (slot) =>
        slot.budget != null
    );

  const needsExactTimes =
    slots.some(
      (slot) =>
        !slot.startTime ||
        !slot.endTime ||
        !slot.exactTimeRange
    );

  return {
    multiSlot: true,
    slots,
    sharedBudget,
    needsExactTimes,
    readyForMatching:
      !needsExactTimes &&
      slots.every(
        (slot) =>
          Boolean(
            slot.date &&
            slot.startTime &&
            slot.endTime
          )
      ),

    // Publication groupée sera branchée
    // à l'étape suivante.
    publicationProtected:
      true,

    totals: {
      slotCount:
        slots.length,
      knownHours,
      totalHours:
        hoursComplete
          ? knownHours
          : null,
      hoursComplete,
      knownBudgetTotal,
      totalBudget:
        budgetComplete
          ? knownBudgetTotal
          : null,
      budgetComplete,
    },
  };
}

export function buildMultiSlotReply(
  params: {
    schedule:
      BrainMultiSlotSchedule;
    serviceLabel:
      string;
    city:
      string | null;
  }
) {
  const {
    schedule,
    serviceLabel,
    city,
  } = params;

  const lines =
    schedule.slots.map(
      (slot, index) => {
        const parts:
          string[] = [];

        parts.push(
          String(index + 1) +
            ". " +
            slot.date
        );

        if (
          slot.exactTimeRange &&
          slot.startTime &&
          slot.endTime
        ) {
          parts.push(
            slot.startTime +
              "-" +
              slot.endTime
          );
        } else {
          const label =
            daypartLabel(
              slot.daypart
            );

          if (label) {
            parts.push(
              label +
                " (debut approx. " +
                String(
                  slot.startTime
                ) +
                ")"
            );
          } else if (
            slot.startTime
          ) {
            parts.push(
              "debut " +
                slot.startTime +
                ", fin a preciser"
            );
          } else {
            parts.push(
              "horaire a preciser"
            );
          }
        }

        if (
          slot.durationHours !=
          null
        ) {
          parts.push(
            hours(
              slot.durationHours
            )
          );
        }

        if (
          slot.budget != null
        ) {
          parts.push(
            "budget " +
              money(
                slot.budget
              )
          );
        }

        if (
          slot.maxHourlyRate !=
          null
        ) {
          parts.push(
            "max " +
              money(
                slot.maxHourlyRate
              ) +
              "/h"
          );
        }

        return parts.join(
          " | "
        );
      }
    );

  const header =
    "J ai compris une demande " +
    "multi-creneaux pour " +
    serviceLabel +
    (
      city
        ? " a " + city
        : ""
    ) +
    ".";

  const totals:
    string[] = [];

  if (
    schedule.totals.totalHours !=
    null
  ) {
    totals.push(
      "Total heures: " +
        hours(
          schedule.totals
            .totalHours
        )
    );
  } else if (
    schedule.totals
      .knownHours > 0
  ) {
    totals.push(
      "Heures deja calculables: " +
        hours(
          schedule.totals
            .knownHours
        )
    );
  }

  if (
    schedule.totals.totalBudget !=
    null
  ) {
    totals.push(
      "Budget total: " +
        money(
          schedule.totals
            .totalBudget
        )
    );
  } else if (
    schedule.totals
      .knownBudgetTotal > 0
  ) {
    totals.push(
      "Budgets deja connus: " +
        money(
          schedule.totals
            .knownBudgetTotal
        )
    );
  }

  const followUp =
    schedule.needsExactTimes
      ? "Pour calculer toutes les heures exactement et comparer les disponibilites, precise les heures de debut et de fin des creneaux incomplets."
      : "Tous les creneaux ont des heures exactes. KLYX a calcule les durees et les budgets correspondants.";

  return [
    header,
    "",
    ...lines,
    "",
    ...totals,
    "",
    followUp,
    "",
    "Aucune publication, reservation ou paiement ne sera execute automatiquement.",
  ].join("\n");
}