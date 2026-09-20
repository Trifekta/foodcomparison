"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { META_PIXEL_ID, isMetaPixelConfigured } from "@/lib/analytics/meta-pixel";

/**
 * Meta's tracking pixel, for attributing visits to the ads that paid for them.
 *
 * Mounted once in the root layout and skipped on /admin, on the same reasoning
 * as the presence heartbeat: the staff pages are not an audience, and an ad
 * account that learns what its own operators do learns nothing worth knowing.
 *
 * afterInteractive rather than the snippet's own async tag, so the pixel loads
 * after the page is usable. It is measurement: it must never sit in front of a
 * customer trying to upload a screenshot on a phone.
 */
declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void };
  }
}

export function MetaPixel() {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin") ?? false;

  /**
   * The base snippet fires the first PageView itself. Firing another one here
   * on mount would double-count every visit, so the first pathname this
   * component sees is deliberately skipped and only real in-app navigations
   * are reported - Next moves between /, /find and /r without a document load,
   * and Meta would otherwise see a single page per session.
   */
  const reported = useRef(false);

  useEffect(() => {
    if (!isMetaPixelConfigured() || isAdmin) return;

    if (!reported.current) {
      reported.current = true;
      return;
    }

    window.fbq?.("track", "PageView");
  }, [pathname, isAdmin]);

  if (!isMetaPixelConfigured() || isAdmin) return null;

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');`}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          alt=""
          src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}
