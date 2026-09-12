"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff, Check } from "lucide-react";
import { subscribeAdminPush, unsubscribeAdminPush } from "@/lib/admin/actions";
import {
  currentPushState,
  currentSubscription,
  enablePush,
  pushSupported,
  type PushState,
} from "@/lib/push/client";

/**
 * New-request notifications, per device.
 *
 * Small and out of the way on purpose. This sits beside the existing alert
 * banner rather than in the middle of the dashboard: it is configured once per
 * device and then never thought about again, and the screen it lives on is the
 * one somebody uses to actually work.
 *
 * Per device, not per person. An admin with a phone and a laptop registers
 * twice and both are notified - which is the point, since the phone is the one
 * that buzzes while they are away from the desk.
 */
export function AdminPushToggle({ publicKey }: { publicKey: string }) {
  const [state, setState] = useState<PushState>("unsupported");
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Deferred by a tick rather than set straight from the effect body: the
  // permission is a browser-only value, so reading it during render would make
  // the server and the client disagree, and setting it synchronously in the
  // effect is the pattern React now warns about. One tick later is invisible
  // and correct.
  useEffect(() => {
    const timer = setTimeout(() => {
      setState(currentPushState());
      void currentSubscription().then((subscription) => {
        if (subscription) setEndpoint(subscription.endpoint);
      });
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const onEnable = () => {
    setState("working");
    startTransition(async () => {
      try {
        const subscription = await enablePush(publicKey);
        if (!subscription) {
          setState(Notification.permission === "denied" ? "denied" : "idle");
          return;
        }

        const result = await subscribeAdminPush(subscription);
        if (!result.ok) {
          setState("error");
          return;
        }

        setEndpoint(subscription.endpoint);
        setState("enabled");
      } catch {
        setState("error");
      }
    });
  };

  const onDisable = () => {
    if (!endpoint) return;
    startTransition(async () => {
      await unsubscribeAdminPush(endpoint);
      // The browser keeps its permission; this device simply stops being on the
      // list, so turning it back on later needs no second prompt.
      setState("idle");
      setEndpoint(null);
    });
  };

  if (state === "unsupported" || !pushSupported()) return null;

  if (state === "denied") {
    return (
      <p className="inline-flex items-center gap-1.5 text-xs text-ink-500">
        <BellOff aria-hidden="true" className="h-3.5 w-3.5" />
        Notifications are blocked for this site in this browser.
      </p>
    );
  }

  if (state === "enabled" && endpoint) {
    return (
      <span className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700">
        <Check aria-hidden="true" className="h-3.5 w-3.5" />
        New request notifications on
        <button
          type="button"
          onClick={onDisable}
          disabled={pending}
          className="font-medium text-ink-500 underline underline-offset-2 hover:text-ink-800 disabled:opacity-50"
        >
          Turn off
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onEnable}
      disabled={pending || state === "working"}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-ink-200 px-3 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-50"
    >
      <Bell aria-hidden="true" className="h-3.5 w-3.5" />
      {state === "working" ? "Turning on…" : "Enable new request notifications"}
      {state === "error" ? <span className="text-red-700"> — that didn&apos;t work</span> : null}
    </button>
  );
}
