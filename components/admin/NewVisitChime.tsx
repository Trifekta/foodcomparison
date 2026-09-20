"use client";

import { useEffect, useRef } from "react";

/** Matches the Live page's own refresh cadence, so nothing here feels out of step with it. */
const POLL_MS = 15_000;

/**
 * Two short sine tones, synthesized rather than an audio file - nothing to
 * source, host, or keep in sync with a brand refresh, and every browser this
 * app targets already ships the Web Audio API that makes it.
 */
function playPing(ctx: AudioContext): void {
  const now = ctx.currentTime;
  [880, 1320].forEach((freq, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;

    const start = now + index * 0.09;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.2, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.25);
  });
}

/**
 * A ping for as long as an admin has any admin page open.
 *
 * Mounted once in the protected admin layout rather than on the Live page
 * alone, so it plays whichever screen somebody is actually working from -
 * rebuilding a basket on Submissions is exactly when a new arrival is worth
 * an ear rather than a screen nobody is looking at.
 *
 * Counts from the moment this component mounts, not from further back: an
 * admin opening the panel to five people already on the site should not hear
 * five pings for visits that started before they were watching.
 */
export function NewVisitChime() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sinceRef = useRef<string>(new Date().toISOString());

  useEffect(() => {
    // Browsers refuse to play audio before the page has had any interaction
    // at all. Creating the context lazily, on the first click or keypress
    // anywhere on the page, is what lets the first real ping through instead
    // of it always being silently dropped by the autoplay policy.
    const ensureAudio = () => {
      const ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!ctor) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new ctor();
      } else if (audioCtxRef.current.state === "suspended") {
        void audioCtxRef.current.resume();
      }
    };
    ensureAudio();
    document.addEventListener("pointerdown", ensureAudio);
    document.addEventListener("keydown", ensureAudio);

    let cancelled = false;

    const poll = async () => {
      // A background tab is not being watched, so a new arrival there is not
      // worth interrupting whatever else the admin is doing.
      if (document.visibilityState !== "visible") return;

      try {
        const response = await fetch(
          `/admin/new-visits?since=${encodeURIComponent(sinceRef.current)}`,
          { cache: "no-store" },
        );
        if (!response.ok) return;

        const data = (await response.json()) as { count: number; latestSeenAt: string };
        if (cancelled) return;

        sinceRef.current = data.latestSeenAt;

        if (data.count > 0 && audioCtxRef.current) {
          if (audioCtxRef.current.state === "suspended") await audioCtxRef.current.resume();
          playPing(audioCtxRef.current);
        }
      } catch {
        // A missed ping is not worth breaking anything over - the next poll
        // tries again with the same "since" it already had.
      }
    };

    const timer = setInterval(poll, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("pointerdown", ensureAudio);
      document.removeEventListener("keydown", ensureAudio);
    };
  }, []);

  return null;
}
