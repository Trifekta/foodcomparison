import { NextResponse } from "next/server";
import { MAX_IMAGE_BYTES, RATE_LIMIT_MAX_EXTRACTIONS, RATE_LIMIT_WINDOW_MS } from "@/lib/constants";
import { isExtractionConfigured } from "@/lib/env";
import { structureImage } from "@/lib/extraction/structure";
import { checkRateLimit, clientKeyFromHeaders } from "@/lib/utils/rate-limit";
import { validateImageFile } from "@/lib/validation/image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Reading a customer's screenshot, for the customer.
 *
 * The admin has had this since the beginning; this is the same model call moved
 * to the front of the funnel, because the customer is the one who has to correct
 * a bad read and the browser's own OCR was giving them bad reads. On the one
 * real payment summary measured here, Tesseract returned the 2.70 service fee as
 * 52.70 and missed a 16.20 discount entirely.
 *
 * Two things make this different from every other model call in the codebase,
 * and both of them shape what is below.
 *
 * It is anonymous. There is no account to attach a cost to, so the rate limit is
 * the only thing standing between a stranger with a script and a bill. It gets
 * its own tighter budget - a customer needs two reads to finish the wizard, and
 * anybody asking for twelve in ten minutes is not filling in a form.
 *
 * And it sends the image. Every other path here reads the screenshot in
 * somebody's own browser and sends only text. The privacy page says so in
 * as many words, and it has been rewritten alongside this: a customer is now
 * told, before they upload, that the picture is read by a model.
 *
 * Nothing is stored. The image is read, structured and dropped; the basket goes
 * back to the browser for the customer to confirm, and only what they confirm is
 * ever written - by the submission endpoint, exactly as before.
 */
export async function POST(request: Request) {
  if (!isExtractionConfigured()) {
    // 503 rather than 500: the caller is expected to fall back to reading the
    // screenshot in the browser, and that is not an error anybody should see.
    return NextResponse.json({ error: "Reading is not configured." }, { status: 503 });
  }

  const key = clientKeyFromHeaders(request.headers);
  const limit = checkRateLimit(key, RATE_LIMIT_MAX_EXTRACTIONS, RATE_LIMIT_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many reads in a short time." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_IMAGE_BYTES + 1024 * 64) {
    return NextResponse.json({ error: "This image is larger than 10 MB." }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "The upload did not arrive intact." }, { status: 400 });
  }

  const candidate = formData.get("image");
  if (!(candidate instanceof File)) {
    return NextResponse.json({ error: "No image was sent." }, { status: 400 });
  }

  // The same magic-byte check the submission path applies. A file that is not
  // the type it claims never reaches the model.
  const image = await validateImageFile(candidate, "screenshot");
  if (!image.ok) {
    return NextResponse.json({ error: image.error }, { status: 400 });
  }

  const outcome = await structureImage(image);

  if (!outcome.ok) {
    // The reason is deliberately not passed on. A customer can do nothing with
    // "the model returned invalid JSON", and the browser falls back either way.
    const status = outcome.reason === "not_configured" ? 503 : 502;
    return NextResponse.json({ error: "The screenshot could not be read." }, { status });
  }

  // The basket only. Nothing about the model, the prompt or the timings is the
  // customer's business, and none of it would survive their edits anyway.
  return NextResponse.json({ basket: outcome.run.basket }, { status: 200 });
}
