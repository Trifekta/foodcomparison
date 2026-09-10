import Link from "next/link";
import { BRAND_NAME } from "@/lib/constants";

/** Wordmark only. There is no navigation menu in the customer experience. */
export function BrandHeader({ href = "/" }: { href?: string }) {
  return (
    <header className="flex items-center justify-center py-6">
      <Link
        href={href}
        className="text-lg font-black tracking-[0.28em] text-ink-900"
        aria-label={`${BRAND_NAME} home`}
      >
        {BRAND_NAME}
      </Link>
    </header>
  );
}
