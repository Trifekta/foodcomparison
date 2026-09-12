"use client";

import { useEffect, useState } from "react";
import { Bell, BellRing, Check } from "lucide-react";
import {
  currentPushState,
  enablePush,
  pushSupported,
  type PushState,
} from "@/lib/push/client";

/**
 * "We'll tell you when it's ready", made true.
 *
 * The page below this already polls, so a customer who stays gets their result
 * without touching anything. This is for the one who closes the tab - which,
 * for a five-minute wait on a phone, is most of them.
 *
 * The permission prompt only ever comes from this button. Browsers refuse one
 * that no gesture asked for, and some treat an unprompted request as a refusal
 * they then remember - so asking on page load would quietly burn the only
 * chance to ask at all.
 *
 * A refusal is final here. No second banner, no "are you sure": somebody who
 * said no has told us, and the result still arrives on the page and by the
 * message the admin sends.
 */
export function NotificationPrompt({ token, publicKey }: { token: string; publicKey: string }) {
  // Starts as unsupported so the server and the first client paint agree -
  // Notification.permission cannot be read during render without the two
  // disagreeing, which React reports as a hydration error.
  const [state, setState] = useState<PushState>("unsupported");

  // Deferred by a tick rather than set straight from the effect body: the
  // permission is a browser-only value, so reading it during render would make
  // the server and the client disagree, and setting it synchronously in the
  // effect is the pattern React now warns about. One tick later is invisible
  // and correct.
  useEffect(() => {
    const timer = setTimeout(() => setState(currentPushState()), 0);
    return () => clearTimeout(timer);
  }, []);

  const onEnable = async () => {
    setState("working");
    try {
      const subscription = await enablePush(publicKey);
      if (!subscription) {
        setState(Notification.permission === "denied" ? "denied" : "idle");
        return;
      }

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...subscription }),
      });

      setState(response.ok ? "enabled" : "error");
    } catch {
      setState("error");
    }
  };

  // Nothing at all on a browser that cannot do this. An explanation of a
  // feature somebody cannot have is just noise on the screen they are waiting
  // on - the page still tells them to keep it open.
  if (state === "unsupported" || !pushSupported()) return null;

  if (state === "enabled") {
    return (
      <p className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-chip-green-bg px-3.5 py-2.5 text-[0.9rem] font-bold text-chip-green-fg">
        <Check aria-hidden="true" className="h-4 w-4 shrink-0" />
        Notifications enabled — we&apos;ll let you know when your result is ready.
      </p>
    );
  }

  if (state === "denied") {
    // Said once, quietly, and never again. It explains why the button they may
    // remember tapping is gone, without asking for anything.
    return (
      <p className="mt-4 text-[0.9rem] leading-relaxed text-slate-500">
        Notifications are turned off for this site, so keep this page open and your result will
        appear here.
      </p>
    );
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={onEnable}
        disabled={state === "working"}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border-2 border-ink-900 px-5 text-[0.95rem] font-bold text-ink-900 transition-colors hover:bg-ink-900 hover:text-white disabled:opacity-60"
      >
        {state === "working" ? (
          <BellRing aria-hidden="true" className="h-4 w-4 shrink-0 animate-pulse" />
        ) : (
          <Bell aria-hidden="true" className="h-4 w-4 shrink-0" />
        )}
        {state === "working" ? "Turning on…" : "Turn on notifications"}
      </button>

      {state === "error" ? (
        <p role="alert" className="mt-2 text-center text-[0.85rem] font-semibold text-slate-500">
          That didn&apos;t work — keep this page open and your result will still appear here.
        </p>
      ) : null}
    </div>
  );
}
