import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const routeSource = readFileSync(
  join(process.cwd(), "app/api/brain/command/route.ts"),
  "utf8"
);

describe("brain command natural status routing contract", () => {
  it("uses a specifically matching grounded action for specific intents", () => {
    expect(routeSource).toContain("bestSpecificBrainCommandAction");
    expect(routeSource).toMatch(
      /specificExistingIntent\s*\?\s*bestSpecificBrainCommandAction/
    );
  });

  it("does not convert a recognized status question without an action into a new request", () => {
    expect(routeSource).toMatch(
      /newNeedIntent\s*\|\|\s*\(\s*!generalActionIntent\s*&&\s*!specificExistingIntent\s*\)/
    );
    expect(routeSource).not.toMatch(
      /newNeedIntent\s*\|\|\s*!generalActionIntent/
    );
  });

  it("keeps automatic execution disabled for grounded and new-request responses", () => {
    const disabledExecutions = routeSource.match(
      /automaticExecutionAllowed:\s*false/g
    );

    expect(disabledExecutions?.length).toBeGreaterThanOrEqual(3);
  });
});
