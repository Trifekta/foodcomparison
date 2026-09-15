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
      // PNG rather than the site's SVG icon: a notification is drawn by the
      // operating system, not the page, and SVG is the one image format that
      // some of them still refuse.
      icon: "/icons/icon-192.png",
      // The badge is the small mark in the status bar, and Android renders it
      // as a mask - it keeps the alpha and throws the colour away, so the gold
      // tile would arrive as a grey lozenge. Hence a separate drawing: see
      // public/icons/badge.svg.
      badge: "/icons/badge.png",
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

      // Opening a window is the only step here that always works, so nothing is
      // allowed to end without it having been tried. The reuse paths below are
      // the nice version - they bring back the window somebody already has open
      // rather than stacking a second copy - but every one of them can fail
      // quietly on a platform that does not implement it, and an earlier version
      // of this handler ended there: focus() resolved, navigate() was not
      // supported, and the tap did nothing at all.
      const open = () => self.clients.openWindow(url.href);

      let windows = [];
      try {
        windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      } catch {
        return open();
      }

      // Already on the exact page: just bring it forward.
      const exact = windows.find((client) => client.url === url.href);
      if (exact) {
        try {
          await exact.focus();
          return;
        } catch {
          return open();
        }
      }

      // Somewhere else on this site: focus it and send it to the right page.
      // Both halves are attempted separately, because focus() succeeding is no
      // promise that navigate() will - notably inside an iOS home-screen app,
      // which is the only place an iPhone can show these at all.
      const sameOrigin = windows.find((client) => client.url.startsWith(self.location.origin));
      if (sameOrigin) {
        try {
          await sameOrigin.focus();
        } catch {
          // Focus is a courtesy. Carry on and try to navigate anyway.
        }

        if (typeof sameOrigin.navigate === "function") {
          try {
            const navigated = await sameOrigin.navigate(url.href);
            if (navigated) return;
          } catch {
            // Not supported here, or refused. Fall through to a new window.
          }
        }
      }

      return open();
    })(),
  );
});
