/**
 * SnipSavor's service worker.
 *
 * It does one job: receive a push and show it. There is deliberately no fetch
 * handler and no caching - the app is server-rendered and its assets are
 * already cached by headers, and an offline cache added for its own sake is the
 * usual way a site starts serving last week's HTML to somebody who cannot work
 * out why.
 *
 * Everything here is defensive. A service worker that throws inside a push
 * event shows the browser's own "This site has been updated in the background"
 * notification instead of ours, which is worse than nothing.
 */

self.addEventListener("install", () => {
  // Take over immediately rather than waiting for every tab to close. There is
  // no cached state to migrate, so there is nothing an old worker is protecting.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // A push with no payload, or one we cannot parse. Still worth showing
    // something: the browser demands a visible notification for every push it
    // delivers, and staying silent costs the permission on some platforms.
  }

  const title = typeof data.title === "string" && data.title ? data.title : "SnipSavor";
  const body =
    typeof data.body === "string" && data.body ? data.body : "Open SnipSavor for the latest.";
  const url = typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      // Replaces an earlier notification about the same thing instead of
      // stacking a second one under it.
      tag: typeof data.tag === "string" && data.tag ? data.tag : undefined,
      renotify: Boolean(data.tag),
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const target = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const url = new URL(target, self.location.origin);
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Reuse the tab that is already on this page, then one on this site, and
      // only open a new one if neither exists. Somebody who left the result
      // page open should be brought back to it, not given a second copy.
      const exact = windows.find((client) => client.url === url.href);
      if (exact) return exact.focus();

      const sameOrigin = windows.find((client) => client.url.startsWith(self.location.origin));
      if (sameOrigin && "navigate" in sameOrigin) {
        await sameOrigin.focus();
        return sameOrigin.navigate(url.href);
      }

      return self.clients.openWindow(url.href);
    })(),
  );
});
