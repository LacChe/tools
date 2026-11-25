// Service worker for the hub: shows a notification when a push arrives, and opens the right page when it is tapped.
// It caches nothing, so the ?v=N stylesheet versioning in CONVENTIONS.md keeps working.
//
// Push payload (JSON): { "title": "...", "body": "...", "url": "tools/expenses/" }, where url is relative to the hub root.

const ROOT = new URL("./", self.location).href;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data.json(); } catch { /* no payload, or not JSON: use the defaults */ }
  // Every push must show a notification, or Safari may drop the subscription.
  event.waitUntil(self.registration.showNotification(data.title || "Tools", {
    body: data.body || "",
    icon: "icons/icon-192.png",
    data: { url: data.url || "" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Relative to the hub root; anything that points outside it opens the hub instead.
  const target = new URL(event.notification.data.url, ROOT).href;
  const url = target.startsWith(ROOT) ? target : ROOT;
  event.waitUntil((async () => {
    const [open] = await self.clients.matchAll({ type: "window" });
    if (open) await (await open.focus()).navigate(url);
    else await self.clients.openWindow(url);
  })());
});
