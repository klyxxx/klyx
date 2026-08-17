import {
  describe,
  expect,
  it,
} from "vitest";

import {
  serviceLabel,
} from "@/lib/provider-search";

describe(
  "KLYX public service labels",
  () => {
    it(
      "uses human labels for initial KLYX services",
      () => {
        expect(
          serviceLabel(
            "cleaning",
            "cleaning"
          )
        ).toBe(
          "Ménage"
        );

        expect(
          serviceLabel(
            "babysitting",
            "babysitting"
          )
        ).toBe(
          "Baby-sitting"
        );

        expect(
          serviceLabel(
            "moving",
            "moving"
          )
        ).toBe(
          "Déménagement"
        );

        expect(
          serviceLabel(
            "handyman",
            "handyman"
          )
        ).toBe(
          "Bricolage"
        );
      }
    );

    it(
      "preserves custom public labels",
      () => {
        expect(
          serviceLabel(
            "plumbing",
            "Plomberie"
          )
        ).toBe(
          "Plomberie"
        );
      }
    );
  }
);
