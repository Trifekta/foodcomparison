"use client";

import { useEffect, useRef } from "react";
import { FoodPhoto } from "@/components/customer/FoodPhoto";
import { ScriptBubble, ScriptNote } from "@/components/customer/Motifs";
import { track, visitId } from "@/lib/analytics/track";
import type { PromotionConfig } from "@/lib/customer/promotion";

function OriginalIllustration() {
  return (
    <div className="relative rounded-3xl bg-linear-to-r from-brand-100 to-beige px-4 py-4 max-[389px]:py-0">
      <div className="relative z-10 max-w-[44%]">
        <ScriptNote underline className="text-[1.35rem] text-ink-900 max-[389px]:text-[1.05rem]">
          Same Food
          <br />
          Lower Prices
        </ScriptNote>
        <p className="mt-2 text-[0.82rem] font-semibold leading-snug text-slate-600 max-[389px]:mt-1 max-[389px]:text-[0.7rem]">
          Upload. Compare.
          <br />
          Save more.
        </p>
      </div>
      <FoodPhoto
        name="spread"
        eager
        className="pointer-events-none absolute right-0 top-1/2 w-[62%] -translate-y-1/2 select-none max-[389px]:w-[56%]"
      />
      <ScriptBubble className="absolute -right-1 -top-2 z-10 text-[0.64rem] leading-tight max-[389px]:text-[0.5rem]">
        Good
        <br />
        Deals Ahead <span aria-hidden="true">&hearts;</span>
      </ScriptBubble>
    </div>
  );
}

export function UploadPromoSlot({ promotion }: { promotion: PromotionConfig | null }) {
  const bannerRef = useRef<HTMLDivElement>(null);
  const viewedRef = useRef(false);

  useEffect(() => {
    if (!promotion || !bannerRef.current) return;
    const key = `snipsavor.promo.viewed:${promotion.startAt}:${promotion.expiresAt}`;
    const banner = bannerRef.current;
    const markViewed = () => {
      if (viewedRef.current || document.visibilityState !== "visible") return;
      const bounds = banner.getBoundingClientRect();
      const visibleHeight = Math.min(bounds.bottom, window.innerHeight) - Math.max(bounds.top, 0);
      if (visibleHeight < bounds.height / 2) return;
      const id = visitId();
      if (!id) return;
      try {
        if (localStorage.getItem(key) === id) {
          viewedRef.current = true;
          return;
        }
        localStorage.setItem(key, id);
      } catch {
        // Storage can be unavailable in an embedded browser. The ref still
        // prevents repeated events within this mount.
      }
      viewedRef.current = true;
      track("promo_banner_viewed");
    };
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) markViewed();
    }, { threshold: 0.5 });
    observer.observe(banner);
    document.addEventListener("visibilitychange", markViewed);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", markViewed);
    };
  }, [promotion]);

  if (!promotion) return <OriginalIllustration />;

  return (
    <div ref={bannerRef} className="rounded-3xl border border-brand-300 bg-brand-100 px-4 py-2 text-ink-900">
      <p className="inline-flex rounded-full border border-chip-green-fg/20 bg-chip-green-bg px-2 py-0.5 text-[0.62rem] font-extrabold uppercase leading-none tracking-[0.08em] text-ink-900">{promotion.label}</p>
      <strong className="mt-0.5 block text-[1.9rem] font-extrabold leading-none tracking-tight">{promotion.headline}</strong>
      <p className="mt-0.5 text-[0.78rem] font-semibold leading-snug text-ink-800">{promotion.supportingLine}</p>
      <p className="mt-1 text-[0.8rem] font-semibold leading-snug">{promotion.message}</p>
      <p className="text-[0.8rem] leading-snug text-slate-700">{promotion.supportingText}</p>
      <p className="mt-0.5 text-[0.67rem] leading-tight text-slate-600">{promotion.disclaimer}</p>
    </div>
  );
}
