import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Keeps the admin's Supabase session cookies fresh, and turns away anonymous
 * requests to /admin before a page renders.
 *
 * This is a first line of defence only. Every admin page also calls
 * requireAdmin() on the server, and the database enforces access through RLS.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  // A manifest is public metadata - the icon, name and start_url a browser
  // reads to build a home-screen shortcut - and the OS can refetch it on its
  // own, independent of whether the admin who added it still has a live
  // session. It must never bounce to login: that would either break the
  // shortcut or, worse, silently fall back to some cached, possibly stale
  // copy of it.
  if (request.nextUrl.pathname === "/admin/manifest.webmanifest") return response;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Without Supabase configured there is no session to refresh; the pages
  // themselves will surface the configuration error.
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isLoginRoute = pathname === "/admin/login";

  if (!user && pathname.startsWith("/admin") && !isLoginRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    loginUrl.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(loginUrl);
  }

  if (user && isLoginRoute) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/admin";
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
