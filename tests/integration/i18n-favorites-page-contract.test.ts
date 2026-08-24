import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX favorites i18n contract", () => {
  it("localizes the page and shared favorite button", () => {
    const page = read("app/favorites/page.tsx");
    const button = read("app/components/FavoriteButton.tsx");

    expect(page).toContain("KLYX_FAVORITES_PAGE_I18N");
    expect(page).toContain("useKlyxLocale");
    expect(page).toContain("translateKlyxFavorites");
    expect(page).toContain("formatKlyxFavoritePrice");
    expect(page).not.toContain("Mes favoris");

    expect(button).toContain("KLYX_FAVORITE_BUTTON_I18N");
    expect(button).toContain("useKlyxLocale");
    expect(button).toContain('t("removeFavorite")');
    expect(button).toContain('t("addFavorite")');
    expect(button).not.toContain("Retirer des favoris");
  });

  it("keeps the favorites page read-only and preserves exact discovery tables", () => {
    const page = read("app/favorites/page.tsx");

    expect(page).toContain('.from("favorites")');
    expect(page).toContain('.from("service_profiles")');
    expect(page).toContain('.from("user_services")');
    expect(page).toContain('.from("profiles")');
    expect(page).toContain('.eq("user_id", activeProfile.id)');
    expect(page).not.toContain(".insert(");
    expect(page).not.toContain(".delete(");
    expect(page).not.toContain(".update(");
    expect(page).not.toContain("error.message");
  });

  it("preserves explicit FavoriteButton mutations and ownership filters", () => {
    const button = read("app/components/FavoriteButton.tsx");

    expect(button).toContain("onClick={toggleFavorite}");
    expect(button).toContain('.from("favorites")');
    expect(button).toContain(".delete()");
    expect(button).toContain('.eq("id", favoriteId)');
    expect(button).toContain('.eq("user_id", userId)');
    expect(button).toContain(".insert({");
    expect(button).toContain("user_id: userId");
    expect(button).toContain("service_profile_id: serviceProfileId");
    expect(button).toContain('router.push("/login")');
    expect(button).not.toContain("setInterval(");
    expect(button).not.toContain("setTimeout(");
  });

  it("keeps provider-authored content verbatim and preserves navigation", () => {
    const page = read("app/favorites/page.tsx");

    expect(page).toContain('favorite.title || t("serviceFallback")');
    expect(page).toContain('favorite.fullName || t("providerFallback")');
    expect(page).toContain('favorite.city || t("cityFallback")');
    expect(page).toContain('href="/search"');
    expect(page).toContain('href={`/providers/${favorite.userId}`}');
  });

  it("preserves the client-only server layout boundary", () => {
    const layout = read("app/favorites/layout.tsx");

    expect(layout).toContain("supabase.auth.getUser()");
    expect(layout).toContain('redirect("/login")');
    expect(layout).toContain('redirect("/profile")');
    expect(layout).toContain('profile.accountType !== "client"');
    expect(layout).toContain('redirect("/dashboard")');
  });
});
