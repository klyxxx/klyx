import { expect, test } from "@playwright/test";

test.describe("KLYX anonymous private API security", () => {
  test("active profile API rejects anonymous reads and writes", async ({ request }) => {
    const readResponse = await request.get("/api/profiles/active");
    expect(readResponse.status()).toBe(401);

    const writeResponse = await request.post("/api/profiles/active", {
      data: { profileId: "00000000-0000-0000-0000-000000000000" },
    });
    expect(writeResponse.status()).toBe(401);
  });

  test("account deletion rejects anonymous destructive requests", async ({ request }) => {
    const response = await request.delete("/api/account/delete", {
      data: { confirmation: "SUPPRIMER" },
    });

    expect(response.status()).toBe(401);
  });

  test("notification mutation rejects anonymous requests", async ({ request }) => {
    const response = await request.post("/api/notifications/read", {
      data: { markAll: true },
    });

    expect(response.status()).toBe(401);
  });
});
