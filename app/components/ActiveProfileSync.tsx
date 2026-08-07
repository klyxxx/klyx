"use client";

import {
  useEffect,
  useRef,
} from "react";
import { useRouter } from "next/navigation";
import {
  KLYX_ACTIVE_PROFILE_CHANGED,
  type ActiveProfileChangedDetail,
} from "@/lib/account-switcher";

export default function ActiveProfileSync() {
  const router = useRouter();
  const refreshTimer =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

  useEffect(() => {
    function refreshApplication(
      event: Event
    ) {
      const customEvent =
        event as CustomEvent<ActiveProfileChangedDetail>;

      if (
        !customEvent.detail?.profileId
      ) {
        return;
      }

      /*
       * Petit délai volontaire :
       * laisse la navigation Next.js démarrer avant de
       * rafraîchir les Server Components et la sidebar.
       * Cela évite un rechargement navigateur complet.
       */
      if (refreshTimer.current) {
        clearTimeout(
          refreshTimer.current
        );
      }

      refreshTimer.current =
        setTimeout(() => {
          router.refresh();
        }, 30);
    }

    window.addEventListener(
      KLYX_ACTIVE_PROFILE_CHANGED,
      refreshApplication
    );

    return () => {
      window.removeEventListener(
        KLYX_ACTIVE_PROFILE_CHANGED,
        refreshApplication
      );

      if (refreshTimer.current) {
        clearTimeout(
          refreshTimer.current
        );
      }
    };
  }, [router]);

  return null;
}
