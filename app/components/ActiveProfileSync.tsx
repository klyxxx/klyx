"use client";

import { useEffect } from "react";

import {
  KLYX_ACTIVE_PROFILE_CHANGED,
  type ActiveProfileChangedDetail,
} from "@/lib/account-switcher";
import { getKlyxAccountHome } from "@/lib/account-home";

export default function ActiveProfileSync() {
  useEffect(() => {
    function onProfileChanged(event: Event) {
      const detail = (event as CustomEvent<ActiveProfileChangedDetail>).detail;
      if (!detail?.profileId) return;

      const target = new URL(
        getKlyxAccountHome(detail.accountType),
        window.location.origin
      );
      target.searchParams.set("profile", detail.profileId);
      target.searchParams.set("switched", String(detail.changedAt));
      window.location.replace(target.toString());
    }

    window.addEventListener(KLYX_ACTIVE_PROFILE_CHANGED, onProfileChanged);
    return () => {
      window.removeEventListener(KLYX_ACTIVE_PROFILE_CHANGED, onProfileChanged);
    };
  }, []);

  return null;
}
