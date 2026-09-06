import {
  describe,
  expect,
  it,
} from "vitest";

import {
  brainConfirmationModeMatches,
  readBrainConfirmationMode,
} from "../../lib/brain-confirmation-mode";

describe(
  "KLYX brain confirmation mode",
  () => {
    it(
      "accepts explicit single only on the single path",
      () => {
        const payload = {
          request: {
            requestMode:
              "single",
          },
        };

        expect(
          brainConfirmationModeMatches(
            payload,
            "single"
          )
        ).toBe(true);

        expect(
          brainConfirmationModeMatches(
            payload,
            "multi_slot"
          )
        ).toBe(false);
      }
    );

    it(
      "accepts explicit multi-slot only on the multi-slot path",
      () => {
        const payload = {
          request: {
            requestMode:
              "multi_slot",
            schedule: {
              multiSlot: true,
              slots: [],
            },
          },
        };

        expect(
          brainConfirmationModeMatches(
            payload,
            "multi_slot"
          )
        ).toBe(true);

        expect(
          brainConfirmationModeMatches(
            payload,
            "single"
          )
        ).toBe(false);
      }
    );

    it(
      "preserves legacy schedule-free single confirmations",
      () => {
        expect(
          brainConfirmationModeMatches(
            {
              request: {
                serviceSlug:
                  "cleaning",
              },
            },
            "single"
          )
        ).toBe(true);
      }
    );

    it(
      "never treats a mode-less schedule as legacy single",
      () => {
        expect(
          brainConfirmationModeMatches(
            {
              request: {
                schedule: {
                  multiSlot: true,
                  slots: [],
                },
              },
            },
            "single"
          )
        ).toBe(false);
      }
    );

    it(
      "fails closed for unknown explicit modes",
      () => {
        const payload = {
          request: {
            requestMode:
              "legacy",
          },
        };

        expect(
          readBrainConfirmationMode(
            payload
          )
        ).toBeNull();

        expect(
          brainConfirmationModeMatches(
            payload,
            "single"
          )
        ).toBe(false);
      }
    );

    it(
      "supports the persisted snake-case alias",
      () => {
        expect(
          brainConfirmationModeMatches(
            {
              request: {
                request_mode:
                  "multi_slot",
              },
            },
            "multi_slot"
          )
        ).toBe(true);
      }
    );
  }
);
