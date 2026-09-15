import Link from "next/link";
import { Wordmark } from "@/components/customer/Wordmark";

/** Wordmark only. There is no navigation menu in the customer experience. */
export function BrandHeader({
  href = "/",
  align = "center",
}: {
  href?: string;
  align?: "center" | "left";
}) {
  return (
    <header className={`flex pb-6 pt-[max(1.5rem,env(safe-area-inset-top))] ${
        align === "center" ? "justify-center" : "justify-start"
      }`}>
      {/* The wordmark is a link, so it is a tap target: 28px of letterforms is
          not something to aim at. The padding is cancelled by the margin, so it
          grows the target without moving the logo. */}
      <Link href={href} className="-m-2 inline-flex min-h-11 items-center rounded-lg p-2">
        <Wordmark size="md" />
      </Link>
    </header>
  );
}
