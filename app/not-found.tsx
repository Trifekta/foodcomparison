import Link from "next/link";
import { BrandHeader } from "@/components/customer/BrandHeader";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5">
      <BrandHeader />
      <main className="flex flex-1 flex-col items-center justify-center text-center">
        <h1 className="text-2xl font-extrabold text-ink-900">Page not found</h1>
        <p className="mt-2 text-base text-ink-600">That link doesn&apos;t lead anywhere.</p>
        <Link
          href="/"
          className="mt-6 inline-flex min-h-14 items-center justify-center rounded-full bg-brand-400 px-7 text-base font-bold text-ink-900"
        >
          Back home
        </Link>
      </main>
    </div>
  );
}
