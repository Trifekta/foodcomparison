import type { MetadataRoute } from "next";
import { PRODUCT_NAME, PRODUCT_DESCRIPTION } from "@/lib/constants";

/**
 * The web app manifest.
 *
 * It exists for one concrete reason beyond tidiness: on iOS, a site can only
 * receive push notifications once it has been added to the home screen, and
 * what a person sees when they do that - the icon, the name under it, the
 * colour behind it while it loads - comes from here. Without a manifest iOS
 * falls back to a screenshot of the page and the page title, which looks like
 * a bookmark rather than an app and is exactly the moment somebody decides not
 * to bother.
 *
 * display: standalone, because the flow it is opened for is one task - look at
 * a result - and the browser chrome around it adds nothing. The colours are the
 * page's own ground, so the splash screen is not a white flash before a cream
 * page.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: PRODUCT_NAME,
    short_name: PRODUCT_NAME,
    description: PRODUCT_DESCRIPTION,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fdfaf4",
    theme_color: "#fdfaf4",
    icons: [
      // Shown as given: the tile keeps its own rounded corners.
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android supplies the shape and crops to it, so this one reaches every
      // edge and keeps the mark well inside the middle.
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
