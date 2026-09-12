"use client";

/**
 * The browser half of push: register the worker, ask, subscribe.
 *
 * Shared by the customer's waiting page and the admin dashboard, because the
 * sequence is identical for both and the interesting part - what happens when
 * the answer is no - is easy to get subtly different in two places.
 */

export type PushState =
  /** This browser cannot do push at all. The control should not appear. */
  | "unsupported"
  /** Available, never asked. */
  | "idle"
  /** Asking, or registering with the server. */
  | "working"
  | "enabled"
  /** The customer said no. We do not ask again. */
  | "denied"
  | "error";

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * What this browser has already decided.
 *
 * Read before anything is rendered, so somebody who has already granted
 * permission is shown the quiet confirmation rather than being asked again -
 * and somebody who refused is not asked a second time either.
 */
export function currentPushState(): PushState {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "granted") return "enabled";
  if (Notification.permission === "denied") return "denied";
  return "idle";
}

/** The VAPID public key, as the PushManager wants it. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  const output = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) output[index] = raw.charCodeAt(index);
  return output;
}

function keyToBase64Url(key: ArrayBuffer | null): string {
  if (!key) return "";
  const bytes = new Uint8Array(key);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface BrowserSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Ask, then subscribe.
 *
 * Must be called from a click. Browsers refuse a permission prompt that no
 * gesture asked for, and some of them count an unprompted request as a refusal
 * and never ask again - so the caller's job is to be a button.
 *
 * Returns null when the answer was no, which the caller shows as "denied"
 * rather than as a failure: a customer who does not want notifications has not
 * done anything wrong, and the page still works.
 */
export async function enablePush(publicKey: string): Promise<BrowserSubscription | null> {
  if (!pushSupported()) return null;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const registration = await navigator.serviceWorker.register("/sw.js");
  // A worker that is installing cannot be subscribed to yet.
  await navigator.serviceWorker.ready;

  // Reuse the existing subscription where there is one, so a second tap does
  // not churn the endpoint and orphan the row the server already holds.
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    }));

  return {
    endpoint: subscription.endpoint,
    p256dh: keyToBase64Url(subscription.getKey("p256dh")),
    auth: keyToBase64Url(subscription.getKey("auth")),
  };
}

/** The endpoint this browser is already registered under, if any. */
export async function currentSubscription(): Promise<BrowserSubscription | null> {
  if (!pushSupported() || Notification.permission !== "granted") return null;

  try {
    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return null;

    return {
      endpoint: subscription.endpoint,
      p256dh: keyToBase64Url(subscription.getKey("p256dh")),
      auth: keyToBase64Url(subscription.getKey("auth")),
    };
  } catch {
    return null;
  }
}
