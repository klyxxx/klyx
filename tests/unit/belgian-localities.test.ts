import { describe, expect, it } from "vitest";

import {
  findBelgianLocality,
  isBelgianLocalityPostalCode,
} from "@/lib/belgian-localities";

describe("KLYX Belgian locality postal integrity", () => {
  it("accepts a postal code that belongs to the selected locality", () => {
    const liege = findBelgianLocality("Liège");

    expect(liege).not.toBeNull();
    expect(isBelgianLocalityPostalCode(liege!, "4000")).toBe(true);
    expect(isBelgianLocalityPostalCode(liege!, "4020")).toBe(true);
  });

  it("rejects a postal code that belongs to another locality", () => {
    const liege = findBelgianLocality("Liège");

    expect(liege).not.toBeNull();
    expect(isBelgianLocalityPostalCode(liege!, "1000")).toBe(false);
  });

  it("normalizes whitespace around a submitted postal code", () => {
    const bruxelles = findBelgianLocality("Bruxelles");

    expect(bruxelles).not.toBeNull();
    expect(isBelgianLocalityPostalCode(bruxelles!, " 1000 ")).toBe(true);
  });
});
