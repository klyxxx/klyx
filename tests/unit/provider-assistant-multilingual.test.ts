import { describe, expect, it } from "vitest";

import { analyzeProviderAssistantMessage } from "@/lib/provider-assistant";

describe("KLYX provider assistant multilingual engine", () => {
  it("keeps the advertised French availability example working", () => {
    const result = analyzeProviderAssistantMessage(
      "Je suis libre jeudi de 9 h à 14 h.",
      25
    );

    expect(result.intent).toBe("availability");
    expect(result.requiresConfirmation).toBe(true);
    expect(result.payload).toMatchObject({
      dayOfWeek: 4,
      dayLabel: "jeudi",
      startTime: "09:00",
      endTime: "14:00",
    });
    expect(result.title).toBe("Disponibilité du jeudi");
  });

  it.each([
    [
      "en",
      "I am free Thursday from 9 to 14.",
      "Thursday",
      "Thursday availability",
    ],
    [
      "nl",
      "Ik ben donderdag vrij van 9 tot 14.",
      "donderdag",
      "Beschikbaarheid op donderdag",
    ],
    [
      "de",
      "Ich bin Donnerstag von 9 bis 14 Uhr frei.",
      "Donnerstag",
      "Verfügbarkeit am Donnerstag",
    ],
  ])("detects %s availability without changing apply payload semantics", (
    _locale,
    message,
    dayLabel,
    title
  ) => {
    const result = analyzeProviderAssistantMessage(message, 25);

    expect(result.intent).toBe("availability");
    expect(result.requiresConfirmation).toBe(true);
    expect(result.payload).toMatchObject({
      dayOfWeek: 4,
      dayLabel,
      startTime: "09:00",
      endTime: "14:00",
    });
    expect(result.title).toBe(title);
  });

  it("supports English 12-hour ranges while persisting 24-hour times", () => {
    const result = analyzeProviderAssistantMessage(
      "I am available Friday from 9:30 am to 2 pm.",
      null
    );

    expect(result.intent).toBe("availability");
    expect(result.payload).toMatchObject({
      dayOfWeek: 5,
      startTime: "09:30",
      endTime: "14:00",
    });
  });

  it.each([
    ["fr", "Prépare un devis pour 3 heures.", "Brouillon de devis"],
    ["en", "Prepare a quote for 3 hours.", "Quote draft"],
    ["nl", "Maak een offerte voor 3 uur.", "Offerteconcept"],
    ["de", "Bereite ein Angebot für 3 Stunden vor.", "Angebotsentwurf"],
  ])("detects %s quote requests and preserves the price calculation", (
    _locale,
    message,
    title
  ) => {
    const result = analyzeProviderAssistantMessage(message, 25);

    expect(result.intent).toBe("quote");
    expect(result.requiresConfirmation).toBe(true);
    expect(result.title).toBe(title);
    expect(result.payload).toEqual({
      hours: 3,
      hourlyRate: 25,
      estimatedTotal: 75,
    });
  });

  it.each([
    [
      "fr",
      "Réponds au client que je suis disponible.",
      "Brouillon de réponse client",
      "Bonjour",
    ],
    [
      "en",
      "Reply to the client that I am available.",
      "Client reply draft",
      "Hello",
    ],
    [
      "nl",
      "Antwoord de klant dat ik beschikbaar ben.",
      "Conceptantwoord aan klant",
      "Hallo",
    ],
    [
      "de",
      "Antworte dem Kunden, dass ich verfügbar bin.",
      "Entwurf einer Kundenantwort",
      "Hallo",
    ],
  ])("detects %s client replies and keeps them as drafts", (
    _locale,
    message,
    title,
    greeting
  ) => {
    const result = analyzeProviderAssistantMessage(message, 25);

    expect(result.intent).toBe("client_reply");
    expect(result.requiresConfirmation).toBe(true);
    expect(result.title).toBe(title);
    expect(result.payload.message).toEqual(expect.any(String));
    expect(String(result.payload.message)).toContain(greeting);
  });

  it("keeps quote drafts useful when no hourly rate exists", () => {
    const result = analyzeProviderAssistantMessage(
      "Prepare a quote for 2 hours.",
      null
    );

    expect(result.intent).toBe("quote");
    expect(result.payload).toEqual({
      hours: 2,
      hourlyRate: null,
      estimatedTotal: null,
    });
    expect(result.reply).toContain("no active hourly rate");
  });

  it("keeps unknown requests non-executing and confirmation-gated", () => {
    const result = analyzeProviderAssistantMessage(
      "I would like some help with my activity.",
      25
    );

    expect(result.intent).toBe("unknown");
    expect(result.payload).toEqual({});
    expect(result.requiresConfirmation).toBe(true);
  });
});
