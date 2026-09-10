import { NextResponse } from "next/server";
import { MAX_IMAGE_BYTES, RATE_LIMIT_MAX_EXTRACTIONS } from "@/lib/constants";
import { formatMinorToDecimalString } from "@/lib/calculations/money";
import { extractBasket } from "@/lib/extraction/extract";
import type { ExtractionResponse } from "@/lib/extraction/schema";
import { checkRateLimit, clientKeyFromHeaders } from "@/lib/utils/rate-limit";
import { validateImageFile } from "@/lib/validation/image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Reads an uploaded cart screenshot and proposes a basket.
 *
 * Nothing is stored here and nothing is written to the database: the image is
 * read, the proposal is returned, and both are discarded. The submission
 * endpoint remains the only write path. A failure is not an error the customer
 * needs to see - they simply fill the confirm step in themselves - so every
 * unhappy path returns 200 with `readable: false` rather than a status the
 * browser has to special-case.
 */

const UNREADABLE: ExtractionResponse = {
  restaurantName: null,
  items: [],
  orderTotal: null,
  readable: false,
};

export async function POST(request: Request) {
  // Its own bucket: this endpoint costs money per call, unlike the rest.
  const limit = checkRateLimit(
    `extract:${clientKeyFromHeaders(request.headers)}`,
    RATE_LIMIT_MAX_EXTRACTIONS,
  );

  if (!limit.allowed) {
    return NextResponse.json(UNREADABLE, {
      status: 200,
      headers: { "Retry-After": String(limit.retryAfterSeconds) },
    });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_IMAGE_BYTES + 1024 * 64) {
    return NextResponse.json(UNREADABLE, { status: 200 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(UNREADABLE, { status: 200 });
  }

  const file = formData.get("cartImage");
  if (!(file instanceof File)) return NextResponse.json(UNREADABLE, { status: 200 });

  // Same magic-byte check the submission path uses: an extension is not proof.
  const image = await validateImageFile(file, "cart screenshot");
  if (!image.ok) return NextResponse.json(UNREADABLE, { status: 200 });

  const outcome = await extractBasket(image);
  if (!outcome.ok) return NextResponse.json(UNREADABLE, { status: 200 });

  const { result } = outcome;
  const body: ExtractionResponse = {
    restaurantName: result.restaurantName,
    items: result.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      linePrice:
        item.linePriceMinor === null ? null : formatMinorToDecimalString(item.linePriceMinor),
    })),
    orderTotal:
      result.orderTotalMinor === null ? null : formatMinorToDecimalString(result.orderTotalMinor),
    readable: result.readable,
  };

  return NextResponse.json(body, { status: 200 });
}
