import type { Metadata } from "next";
import { FindOrder } from "@/components/customer/FindOrder";

export const metadata: Metadata = {
  title: "Find your order",
  robots: { index: false, follow: false },
};

export default function FindPage() {
  return <FindOrder />;
}
