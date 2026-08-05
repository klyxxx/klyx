"use client";

import { useEffect } from "react";

export default function PwaRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    function registerServiceWorker() {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" });
    }

    if (document.readyState === "complete") {
      registerServiceWorker();
    } else {
      window.addEventListener("load", registerServiceWorker, { once: true });
    }
  }, []);

  return null;
}
