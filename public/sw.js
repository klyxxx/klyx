const CACHE_NAME = "klyx-shell-v2";

const APP_SHELL = [
  "/",
  "/install",
  "/offline",
  "/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
  );

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
  );

  self.clients.claim();
});

function shouldBypass(request, url) {
  if (request.method !== "GET") {
    return true;
  }

  if (url.origin !== self.location.origin) {
    return true;
  }

  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/payment/") ||
    url.pathname.startsWith("/connect/")
  );
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/icon.svg" ||
    /\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?)$/i.test(
      url.pathname
    )
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (shouldBypass(request, url)) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          return response;
        })
        .catch(async () => {
          const offline =
            await caches.match("/offline");

          if (offline) {
            return offline;
          }

          return new Response(
            "KLYX est temporairement hors ligne.",
            {
              status: 503,
              headers: {
                "Content-Type":
                  "text/plain; charset=utf-8",
              },
            }
          );
        })
    );

    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(async (cached) => {
        if (cached) {
          return cached;
        }

        const response = await fetch(request);

        if (
          response.ok &&
          response.type === "basic"
        ) {
          const copy = response.clone();

          void caches
            .open(CACHE_NAME)
            .then((cache) =>
              cache.put(request, copy)
            );
        }

        return response;
      })
    );
  }
});
