import fs from "node:fs";
import path from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(
    path.join(process.cwd(), relativePath),
    "utf8"
  );
}

describe(
  "KLYX assistant market confirmation UX",
  () => {
    it(
      "creates confirmation proof only from the explicit publish action",
      () => {
        const source = read(
          "app/assistant/market/page.tsx"
        );
        const publishStart = source.indexOf(
          "async function publishRequest()"
        );
        const renderStart = source.indexOf(
          "return (",
          publishStart
        );

        expect(publishStart).toBeGreaterThan(-1);
        expect(renderStart).toBeGreaterThan(publishStart);

        const beforePublish = source.slice(0, publishStart);
        const publishAction = source.slice(
          publishStart,
          renderStart
        );

        expect(beforePublish).toContain(
          '"/api/brain/respond"'
        );
        expect(beforePublish).not.toContain(
          '"/api/brain/confirm-request"'
        );
        expect(publishAction).toContain(
          '"/api/brain/confirm-request"'
        );
        expect(publishAction).toContain(
          '"/api/brain/market-publish"'
        );
        expect(
          publishAction.indexOf(
            '"/api/brain/confirm-request"'
          )
        ).toBeLessThan(
          publishAction.indexOf(
            '"/api/brain/market-publish"'
          )
        );
        expect(publishAction).toContain(
          "request: requestSnapshot"
        );
        expect(publishAction).toContain(
          "confirmationId: confirmationBody.confirmationId"
        );
        expect(publishAction).toContain(
          "confirmed: true"
        );
      }
    );

    it(
      "publishes the exact confirmed snapshot using the market API field names",
      () => {
        const source = read(
          "app/assistant/market/page.tsx"
        );

        expect(source).toContain(
          "date: requestSnapshot.date"
        );
        expect(source).toContain(
          "time: requestSnapshot.time"
        );
        expect(source).toContain(
          "budget: requestSnapshot.budget"
        );
        expect(source).toContain(
          "requestedDate: requestSnapshot.date"
        );
        expect(source).toContain(
          "requestedTime: requestSnapshot.time"
        );
        expect(source).toContain(
          "budgetMax: requestSnapshot.budget"
        );
        expect(source).toContain(
          "!conversationId"
        );
      }
    );

    it(
      "keeps the assistant-first contract and one-blue visual language",
      () => {
        const source = read(
          "app/assistant/market/page.tsx"
        );

        expect(source).toContain(
          "KLYX_AI_FIRST_ASSISTANT_15_02"
        );
        expect(source).toContain(
          "KLYX_ASSISTANT_CONTROL_STATE_13_94"
        );
        expect(source).toContain(
          "Dis-moi ce qu’il te faut. Je m’occupe du reste avec toi."
        );
        expect(source).toContain(
          "Précisons votre besoin."
        );
        expect(source).toContain(
          "KLYX demande uniquement ce qui manque"
        );
        expect(source).toContain(
          "Confirmer et publier la demande"
        );
        expect(source).not.toMatch(
          /(?:purple|violet|indigo)-/
        );
        expect(source).not.toContain(
          "linear-gradient"
        );
      }
    );
  }
);
