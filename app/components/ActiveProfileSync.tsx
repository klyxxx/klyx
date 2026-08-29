"use client";

import { useEffect } from "react";

import {
  KLYX_ACTIVE_PROFILE_CHANGED,
  type ActiveProfileChangedDetail,
} from "@/lib/account-switcher";

/*
 * Switching a KLYX profile changes an httpOnly cookie that is consumed by
 * Server Components and by several client pages with their own initial data.
 * A router.refresh() alone can leave already-mounted client state showing the
 * previous profile. A single document navigation is intentional here: it is
 * the reliable boundary that makes identity, role, sidebar and page data move
 * together. The profile POST already completed before this event is emitted.
 */
export default function ActiveProfileSync() {
  useEffect(() => {
    function synchronizeApplication(event: Event) {
      const customEvent =
        event as CustomEvent<ActiveProfileChangedDetail>;
      const profileId = customEvent.detail?.profileId;

      if (!profileId) return;

      const target = new URL("/dashboard", window.location.origin);
      target.searchParams.set("profile", profileId);
      target.searchParams.set("switched", String(customEvent.detail.changedAt));

      window.location.replace(target.toString());
    }

    window.addEventListener(
      KLYX_ACTIVE_PROFILE_CHANGED,
      synchronizeApplication
    );

    return () => {
      window.removeEventListener(
        KLYX_ACTIVE_PROFILE_CHANGED,
        synchronizeApplication
      );
    };
  }, []);

  return null;
}
