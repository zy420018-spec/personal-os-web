const CACHE_NAME = "personal-os-shell-v1";
const SCOPE_URL = new URL("./", self.location.href);
const APP_SHELL = [
  SCOPE_URL.href,
  new URL("index.html", SCOPE_URL).href,
  new URL("manifest.webmanifest", SCOPE_URL).href,
  new URL("favicon.svg", SCOPE_URL).href,
  new URL("icons/personal-os-192.png", SCOPE_URL).href,
  new URL("icons/personal-os-512.png", SCOPE_URL).href,
  new URL("icons/personal-os-maskable-512.png", SCOPE_URL).href,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (
    url.origin !== self.location.origin ||
    url.pathname.includes("/api/")
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(
          () =>
            caches.match(request).then((cached) =>
              cached || caches.match(SCOPE_URL.href),
            ),
        ),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (!response || !response.ok) return response;
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        }),
    ),
  );
});
