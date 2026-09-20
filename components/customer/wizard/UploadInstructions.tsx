"use client";

import { useEffect, useState } from "react";

/**
 * App links for opening food delivery apps. These are deep links that work on
 * mobile and fallback to the web app on desktop.
 */
const FOOD_APPS = [
  {
    name: "Talabat",
    icon: "📱",
    bgColor: "bg-red-500",
    webUrl: "https://www.talabat.com",
  },
  {
    name: "Careem",
    icon: "🚗",
    bgColor: "bg-green-500",
    webUrl: "https://careem.com",
  },
  {
    name: "Deliveroo",
    icon: "🛵",
    bgColor: "bg-cyan-500",
    webUrl: "https://deliveroo.ae",
  },
  {
    name: "Noon Food",
    icon: "🌙",
    bgColor: "bg-yellow-400",
    webUrl: "https://www.noon.com",
  },
];

interface UploadInstructionsProps {
  onUserReturned?: () => void;
}

/**
 * Instructions for the upload step, showing the process clearly and providing
 * quick-open buttons for food apps.
 *
 * Detects when the user returns from another app using the Page Visibility API
 * and shows a welcome back state.
 */
export function UploadInstructions({ onUserReturned }: UploadInstructionsProps) {
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);
  const [userHasLeft, setUserHasLeft] = useState(false);

  useEffect(() => {
    // Mark that the user has potentially left the app
    const markAsLeft = () => {
      if (document.hidden) {
        sessionStorage.setItem("snipsavor-left-app", "true");
        setUserHasLeft(true);
      }
    };

    // Check if they're coming back
    const handleVisibilityChange = () => {
      if (!document.hidden && sessionStorage.getItem("snipsavor-left-app") === "true") {
        setShowWelcomeBack(true);
        sessionStorage.removeItem("snipsavor-left-app");
        onUserReturned?.();
        // Hide the welcome back message after 3 seconds
        setTimeout(() => setShowWelcomeBack(false), 3000);
      }
    };

    document.addEventListener("visibilitychange", markAsLeft);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", markAsLeft);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [onUserReturned]);

  return (
    <div className="space-y-4">
      {/* Welcome back message */}
      {showWelcomeBack && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <span className="font-semibold">Welcome back!</span> Ready to upload your screenshot?
        </div>
      )}

      {/* Steps section */}
      <div className="rounded-2xl border border-ink-200 bg-white p-4">
        <h2 className="mb-4 text-sm font-bold text-ink-900">Here's how it works:</h2>

        <div className="space-y-3">
          {/* Steps */}
          <div className="space-y-2">
            {[
              { number: 1, text: "Open your food app" },
              { number: 2, text: "Build your cart" },
              { number: 3, text: "Take a screenshot" },
              { number: 4, text: "Come back here" },
            ].map((step) => (
              <div key={step.number} className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-600">
                  {step.number}
                </div>
                <p className="pt-0.5 text-sm text-ink-700">{step.text}</p>
              </div>
            ))}
          </div>

          {/* Quick-open buttons */}
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              Open app
            </p>
            <div className="grid grid-cols-2 gap-2">
              {FOOD_APPS.map((app) => (
                <a
                  key={app.name}
                  href={app.webUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-ink-200 bg-white p-3 text-sm font-medium text-ink-900 transition-colors hover:bg-ink-50"
                  onClick={() => {
                    // Mark that user is leaving
                    sessionStorage.setItem("snipsavor-left-app", "true");
                  }}
                >
                  <span className="text-base">{app.icon}</span>
                  <span>{app.name}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Info text */}
      <p className="text-xs text-ink-500">
        <span className="inline-block rounded-full bg-ink-100 px-2 py-0.5">🔒 Private</span>{" "}
        Your screenshots stay on this device. We check your price, you get the result.
      </p>
    </div>
  );
}
