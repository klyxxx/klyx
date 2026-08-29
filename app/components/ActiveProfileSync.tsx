"use client";

import { useEffect } from "react";

import {
  KLYX_ACTIVE_PROFILE_CHANGED,
  type ActiveProfileChangedDetail,
} from "@/lib/account-switcher";

/*
 * The active profile is stored in an httpOnly cookie and controls both data
 * access and the role-specific application shell. A profile change therefore
 * crosses a full document boundary: no client cache, React state or previous
 * role navigation is allowed to survive it.
 */
export default function ActiveProfileSync() {
  useEffect(() => {
    function synchronizeApplication(event: Event) {
      const customEvent = event as CustomEvent<ActiveProfileChangedDetail>;
      const detail = customEvent.detail;

      if (!detail?.profileId) return;

      const pathname =
        detail.accountType === "provider"
          ? "/provider/jobs"
          : "/assistant";
      const target = new URL(pathname, window.location.origin);
      target.searchParams.set("profile", detail.profileId);
      target.searchParams.set("switched", String(detail.changedAt));

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
