import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX notifications page i18n and safety contract", () => {
  it("uses the shared locale provider, typed dictionary and locale-aware dates", () => {
    const page = read("app/notifications/page.tsx");

    expect(page).toContain("KLYX_NOTIFICATIONS_I18N");
    expect(page).toContain("useKlyxLocale");
    expect(page).toContain("translateKlyxNotifications");
    expect(page).toContain("formatKlyxNotificationsUnreadSummary");
    expect(page).toContain("getKlyxNotificationsLocaleTag");
    expect(page).not.toContain('.toLocaleString(\n                            "fr-BE"');
  });

  it("does not reflect raw profile, database or read-action errors", () => {
    const page = read("app/notifications/page.tsx");

    expect(page).toContain("KLYX_NOTIFICATIONS_SAFE_ERRORS");
    expect(page).not.toContain("profileBody.error");
    expect(page).not.toContain("error.message");
    expect(page).not.toContain("result.error");
    expect(page).not.toContain("throw new Error(error.message)");
    expect(page).toContain('setErrorKey("loadError")');
    expect(page).toContain('setErrorKey("actionError")');
  });

  it("preserves authentication, active-profile lookup and no-store semantics", () => {
    const page = read("app/notifications/page.tsx");

    expect(page).toContain('router.replace("/login")');
    expect(page).toContain('"/api/profiles/active"');
    expect(page).toContain('method: "GET"');
    expect(page).toContain('cache: "no-store"');
    expect(page).toContain("profile.id ===");
    expect(page).toContain("profileBody.activeProfileId");
  });

  it("preserves the read-only notification query and ordering", () => {
    const page = read("app/notifications/page.tsx");

    expect(page).toContain('.from("user_notifications")');
    expect(page).toContain(
      '"id, type, title, message, href, read_at, created_at"'
    );
    expect(page).toContain('.eq("user_id", activeProfile.id)');
    expect(page).toContain('.order("created_at", {');
    expect(page).toContain("ascending: false");
    expect(page).not.toContain('.from("user_notifications")\n        .update(');
    expect(page).not.toContain('.from("user_notifications")\n        .insert(');
    expect(page).not.toContain('.from("user_notifications")\n        .delete(');
  });

  it("preserves explicit single and mark-all read POST contracts", () => {
    const page = read("app/notifications/page.tsx");

    expect(page.match(/"\/api\/notifications\/read"/g)?.length).toBe(2);
    expect(page.match(/method: "POST"/g)?.length).toBe(2);
    expect(page).toContain("Authorization: `Bearer ${session.access_token}`");
    expect(page).toContain("notificationId,");
    expect(page).toContain("markAll: true");
    expect(page).toContain("new Date().toISOString()");
    expect(page).toContain("notification.read_at ?? now");
  });

  it("keeps opening a notification user-triggered and preserves its destination", () => {
    const page = read("app/notifications/page.tsx");

    expect(page).toContain("async function openNotification(");
    expect(page).toContain("await markRead(notification.id)");
    expect(page).toContain("router.push(notification.href)");
    expect(page).toContain("onClick={() =>");
    expect(page).not.toContain("setInterval(");
    expect(page).not.toContain("setTimeout(");
  });

  it("keeps stored notification content untouched and the dashboard destination stable", () => {
    const page = read("app/notifications/page.tsx");

    expect(page).toContain("{notification.title}");
    expect(page).toContain("{notification.message}");
    expect(page).toContain('href="/dashboard"');
    expect(page).not.toContain("stripe");
    expect(page).not.toContain("refund");
    expect(page).not.toContain("payment_intent");
  });
});
