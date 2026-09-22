import { NextResponse, type NextRequest } from "next/server";

/**
 * Temporary UX test: send landing-page visitors straight to the upload wizard.
 *
 * The ad already explains the concept, so the intro screen is redundant
 * context for ad traffic. All query parameters (UTM, fbclid, etc.) are
 * preserved, and captureAttribution() on the upload page captures them
 * exactly as the landing page would have.
 *
 * To restore the normal flow: set BYPASS_INTRO to false, or delete this file.
 */
const BYPASS_INTRO = true;

export function middleware(request: NextRequest) {
  if (!BYPASS_INTRO) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/compare";
  return NextResponse.redirect(url, 302);
}

export const config = {
  matcher: "/",
};
