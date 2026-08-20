import { NextRequest } from "next/server";
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { updateSession } from "@/lib/supabase/middleware";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("KLYX middleware fail-closed behavior", () => {
  it("redirects protected routes when Supabase public config is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    const response = await updateSession(
      new NextRequest(
        "https://klyx.test/bookings/example-booking?tab=payment"
      )
    );

    expect(response.status).toBe(307);

    const location = response.headers.get("location");
    expect(location).not.toBeNull();

    const url = new URL(location!);
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("redirect")).toBe(
      "/bookings/example-booking?tab=payment"
    );
    expect(url.searchParams.has("tab")).toBe(false);
  });

  it("keeps public routes available when Supabase public config is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    const response = await updateSession(
      new NextRequest("https://klyx.test/")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});
