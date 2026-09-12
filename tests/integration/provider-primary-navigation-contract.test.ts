import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

function blockBetween(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);

  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);

  return source.slice(startIndex, endIndex);
}

describe("KLYX provider primary navigation", () => {
  it("keeps the provider work shell limited to Missions, Services and Finances", () => {
    const sidebar = read("app/ui/AppSidebar.tsx");
    const account = read("app/components/AccountSwitcher.tsx");
    const provider = blockBetween(
      sidebar,
      "const providerItems: MenuItem[] = [",
      "function matchesRoute"
    );

    expect(provider).toContain('title: "Missions"');
    expect(provider).toContain('href: "/provider/jobs"');
    expect(provider).toContain('title: "Services"');
    expect(provider).toContain('href: "/provider/studio"');
    expect(provider).toContain('title: "Finances"');
    expect(provider).toContain('href: "/provider/payments"');
    expect(provider).not.toContain('title: "Profil"');
    expect(provider).not.toContain('href: "/profile"');

    const missions = provider.indexOf('title: "Missions"');
    const services = provider.indexOf('title: "Services"');
    const finances = provider.indexOf('title: "Finances"');

    expect(missions).toBeLessThan(services);
    expect(services).toBeLessThan(finances);

    expect(account).toContain('href="/profile"');
    expect(account).toContain('href="/settings"');
    expect(provider).not.toContain('title: "KLYX"');
    expect(provider).not.toContain('title: "Messages"');
    expect(provider).not.toContain('title: "Gestion"');
    expect(provider).not.toContain('href: "/provider/assistant"');
    expect(provider).not.toContain('href: "/messages"');
    expect(provider).not.toContain('href: "/provider/services"');
  });

  it("keeps client work navigation separate from Profile", () => {
    const sidebar = read("app/ui/AppSidebar.tsx");
    const client = blockBetween(
      sidebar,
      "const clientItems: MenuItem[] = [",
      "const providerItems: MenuItem[] = ["
    );

    const klyx = client.indexOf('title: "KLYX"');
    const activity = client.indexOf('title: "Activité"');
    const messages = client.indexOf('title: "Messages"');

    expect(client).toContain('href: "/assistant"');
    expect(client).toContain('href: "/bookings"');
    expect(client).toContain('href: "/messages"');
    expect(client).not.toContain('href: "/profile"');
    expect(klyx).toBeLessThan(activity);
    expect(activity).toBeLessThan(messages);
  });
});
