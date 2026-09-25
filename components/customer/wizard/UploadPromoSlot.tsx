"use client";

import { useEffect, useRef } from "react";
import { FoodPhoto } from "@/components/customer/FoodPhoto";
import { ScriptBubble, ScriptNote, Sparks } from "@/components/customer/Motifs";
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
      <div className="relative min-h-[92px]">
        <div className="relative z-10 max-w-[53%]">
          <p className="flex w-fit rounded-full border border-brand-500 bg-brand-300 px-2.5 py-0.5 text-[0.68rem] font-extrabold uppercase leading-none tracking-[0.06em] text-ink-900">{promotion.label}</p>
          <strong className="relative mt-0.5 block w-fit text-[1.9rem] font-extrabold leading-none tracking-tight before:absolute before:inset-x-0 before:bottom-0 before:h-[5px] before:rounded-full before:bg-brand-300"><span className="relative">{promotion.headline}</span></strong>
          <p className="mt-0.5 text-[0.78rem] font-semibold leading-snug text-ink-800">{promotion.supportingLine}</p>
        </div>
        <span aria-hidden="true" className="pointer-events-none absolute right-0 top-2 h-[72px] w-[48%] max-w-[160px] rounded-[50%] bg-white/70" />
        {/* Supplied food art is decorative; the offer and action remain text. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/food/promo-burger-fries-drink.webp"
          alt=""
          aria-hidden="true"
          width={480}
          height={287}
          loading="eager"
          decoding="async"
          draggable={false}
          className="pointer-events-none absolute right-0 -top-1 h-[92px] w-[52%] select-none object-contain object-right-bottom"
        />
        <Sparks className="pointer-events-none absolute right-[48%] top-0 h-4 w-4" />
      </div>
      <p className="relative mt-0.5 text-[0.8rem] font-semibold leading-snug">{promotion.message}</p>
      <p className="relative text-[0.8rem] leading-snug text-slate-700">{promotion.supportingText}</p>
      <p className="relative mt-0.5 text-[0.67rem] leading-tight text-slate-600">{promotion.disclaimer}</p>
    </div>
  );
}
