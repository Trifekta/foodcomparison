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
    <header className={`flex py-6 ${align === "center" ? "justify-center" : "justify-start"}`}>
      <Link href={href} className="rounded-lg">
        <Wordmark size="md" />
      </Link>
    </header>
  );
}
