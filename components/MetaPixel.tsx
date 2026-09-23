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

/**
 * Keeping the wizard's draft token away from Meta.
 *
 * When drafts are active on this page (the compare page says so in a meta
 * tag, and in test mode only with ?resume_test=1), the token may sit in the URL
 * fragment. The pixel reports the page URL, so it must never see one:
 *
 *   - a page load that already carries a token in its fragment - a resumed
 *     reload - does not load the pixel at all;
 *   - otherwise the pixel's own history tracking is switched off before init,
 *     so writing the token into the fragment later is not reported as a page
 *     view. Real navigations are still reported by the effect below.
 *
 * With the flag off there is no meta tag, resume stays false, and the snippet
 * behaves exactly as it always has.
 */
const RESUME_GUARD = `var m=document.querySelector('meta[name="snipsavor-resume"]');
var mode=m&&m.getAttribute('content');
var resume=mode==='on'||(mode==='test'&&/[?&]resume_test=1(&|$)/.test(location.search));`;
const RESUME_FRAGMENT = "/(^#|&)resume=/";

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
        {`(function(){
${RESUME_GUARD}
if(resume&&${RESUME_FRAGMENT}.test(location.hash))return;
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
if(resume)fbq.disablePushState=true;
fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');
})();`}
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
