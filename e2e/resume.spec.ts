import { expect, test, type Page } from "@playwright/test";
import { FAKE_SUPABASE_URL } from "./constants";
import { makePng } from "./png";

/**
 * Resuming the wizard after the tab is rebuilt, in a real browser.
 *
 * Every reload here first wipes localStorage and sessionStorage - the storage
 * Instagram's and Facebook's in-app browsers cannot be trusted to keep - so
 * whatever comes back came back from the URL and the server-side draft. The
 * hardest cases also drop every cookie, leaving the URL as the only link.
 *
 * The four flows asked for:
 *   1. upload -> reload -> the screenshot is still there
 *   2. upload -> choose area -> reload -> back on the confirm step, not step 1
 *   3. upload -> leave for a food app -> return to a rebuilt tab -> carry on
 *   4. a restored draft submits without the screenshot being picked again
 */

const AREA = {
  id: "3f7d6d1a-6d8b-4c2f-9d51-3c9e2b7f1a55",
  name: "Al Barsha",
  city: "Dubai",
  emirate: "Dubai",
  active: true,
  sort_order: 10,
};

const BASKET = {
  restaurant_name: "Al Safadi",
  source_app: "Talabat",
  currency: "AED",
  items: [
    { name: "Chicken Shawarma", quantity: 2, modifiers: [], unit_price: "", line_total: "40.00" },
    { name: "Hummus", quantity: 1, modifiers: [], unit_price: "", line_total: "18.00" },
  ],
  subtotal: "58.00",
  delivery_fee: "7.00",
  service_fee: "2.70",
  discount: "",
  final_total: "67.70",
  uncertain_fields: [],
};

const CART_PNG = makePng(360, 720, 7);
const CHECKOUT_PNG = makePng(360, 640, 11);

interface FakeState {
  tables: Record<string, Record<string, unknown>[]>;
  objects: Record<string, { contentType: string; base64: string }>;
}

async function fakeState(page: Page): Promise<FakeState> {
  const response = await page.request.get(`${FAKE_SUPABASE_URL}/__fake/state`);
  return (await response.json()) as FakeState;
}

function draftObjects(state: FakeState) {
  return Object.entries(state.objects).filter(([key]) => key.startsWith("submission-images/drafts/"));
}

interface SeenRequest {
  url: string;
  referer: string;
}

/** Every request the page makes, so a test can prove the token never left. */
function recordRequests(page: Page): SeenRequest[] {
  const seen: SeenRequest[] = [];
  page.on("request", (request) => seen.push({ url: request.url(), referer: request.headers().referer ?? "" }));
  return seen;
}

function waitForProgressSave(page: Page, predicate: (body: string) => boolean = () => true) {
  return page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/drafts" &&
      response.request().method() === "PUT" &&
      response.status() === 204 &&
      predicate(response.request().postData() ?? ""),
  );
}

/** Upload a cart screenshot and wait until the draft holds it and the URL carries the token. */
async function uploadCart(page: Page) {
  await page.goto("/compare");
  // Retried: in dev mode a click can land before React has hydrated the page.
  await expect(async () => {
    await page.getByRole("button", { name: /Have a screenshot/ }).click();
    await expect(page.getByLabel("Cart screenshot", { exact: true })).toBeAttached({ timeout: 1_000 });
  }).toPass();

  const stored = page.waitForResponse(
    (response) =>
      response.url().includes("/api/drafts/image?slot=cart") &&
      response.request().method() === "PUT",
  );
  const read = waitForProgressSave(page, (body) => body.includes('"cart":{"status":"applied"'));
  await page.getByLabel("Cart screenshot", { exact: true }).setInputFiles({
    name: "cart.png",
    mimeType: "image/png",
    buffer: CART_PNG,
  });
  expect((await stored).status()).toBe(204);
  await read;
  await expect(page).toHaveURL(/#resume=[A-Za-z0-9_-]{43}$/);
}

async function goToConfirmAndChooseArea(page: Page) {
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("button", { name: /Get a Keeta price/ })).toBeVisible();

  const saved = waitForProgressSave(page, (body) => body.includes(AREA.id) && body.includes('"step":2'));
  await page.getByRole("combobox", { name: "Your delivery area" }).fill("Barsha");
  await page.getByRole("option", { name: /Al Barsha/ }).click();
  await saved;
}

/**
 * What an in-app browser does at its worst: the tab is thrown away and rebuilt
 * from its URL, and nothing the page stored comes back with it.
 */
async function rebuildTab(page: Page, { dropCookies = false } = {}): Promise<Page> {
  const url = page.url();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  const context = page.context();
  if (dropCookies) await context.clearCookies();

  const rebuilt = await context.newPage();
  await page.close();
  await rebuilt.goto(url);
  await expect(rebuilt.getByText("Picking up where you left off…")).toBeHidden();
  return rebuilt;
}

test.beforeEach(async ({ page, context }) => {
  await page.request.post(`${FAKE_SUPABASE_URL}/__fake/reset`);
  await page.request.post(`${FAKE_SUPABASE_URL}/__fake/seed`, { data: { table: "areas", rows: [AREA] } });
  await context.route("**/api/extract", (route) => route.fulfill({ json: { basket: BASKET } }));
});

test("1. upload -> reload -> the screenshot is still there", async ({ page }) => {
  await uploadCart(page);
  const before = draftObjects(await fakeState(page));
  expect(before).toHaveLength(1);

  const rebuilt = await rebuildTab(page, { dropCookies: true });

  await expect(rebuilt.getByRole("button", { name: /View your cart screenshot full size/ })).toBeVisible();
  await expect(rebuilt.getByRole("button", { name: "Continue" })).toBeEnabled();
  await expect(rebuilt.getByText("Add your cart screenshot to continue.")).toBeHidden();

  // Picked once, stored once: the restore did not upload anything new.
  expect(draftObjects(await fakeState(rebuilt))).toEqual(before);
});

test("2. upload -> choose area -> reload -> back on the confirm step", async ({ page }) => {
  await uploadCart(page);
  await goToConfirmAndChooseArea(page);

  const rebuilt = await rebuildTab(page, { dropCookies: true });

  await expect(rebuilt.getByRole("button", { name: /Get a Keeta price/ })).toBeVisible();
  await expect(rebuilt.getByRole("button", { name: "Continue" })).toHaveCount(0);
  await expect(rebuilt.getByRole("combobox", { name: "Your delivery area" })).toHaveValue(/Al Barsha/);
  await expect(rebuilt.getByText("Al Safadi").first()).toBeVisible();
  await expect(rebuilt.getByRole("button", { name: /View your cart screenshot full size/ })).toBeVisible();
});

test("3. upload -> leave for a food app -> return to a rebuilt tab -> carry on", async ({ page }) => {
  await uploadCart(page);
  await goToConfirmAndChooseArea(page);
  await page.getByRole("button", { name: "yes", exact: true }).click();

  // Leaving: the page is hidden, which is the last moment a phone promises to
  // run anything. The change made just before it has to be saved then, not
  // after the usual pause.
  const flushed = waitForProgressSave(page, (body) => body.includes('"newToKeeta":"yes"'));
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await flushed;

  const rebuilt = await rebuildTab(page);
  await expect(rebuilt.getByRole("button", { name: /Get a Keeta price/ })).toBeVisible();
  await expect(rebuilt.getByRole("button", { name: "yes", exact: true })).toHaveAttribute("aria-pressed", "true");

  // Carrying on: the only thing asked for again is the phone number.
  await rebuilt.getByPlaceholder("50 123 4567").fill("501234567");
  const submitted = rebuilt.waitForResponse((response) => response.url().endsWith("/api/submissions"));
  await rebuilt.getByRole("button", { name: /Get a Keeta price/ }).click();
  expect((await submitted).status()).toBe(201);
  await expect(rebuilt).toHaveURL(/\/r\//);
});

test("3b. leaving for a food app without the tab being discarded changes nothing", async ({ page }) => {
  await uploadCart(page);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });

  await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("button", { name: /Get a Keeta price/ })).toBeVisible();
});

test("4. a restored draft submits without the screenshot being picked again", async ({ page }) => {
  const requests = recordRequests(page);
  await uploadCart(page);

  const checkoutStored = page.waitForResponse(
    (response) => response.url().includes("/api/drafts/image?slot=checkout") && response.request().method() === "PUT",
  );
  await page.getByLabel("Checkout total", { exact: true }).setInputFiles({
    name: "checkout.png",
    mimeType: "image/png",
    buffer: CHECKOUT_PNG,
  });
  expect((await checkoutStored).status()).toBe(204);

  await goToConfirmAndChooseArea(page);
  await page.getByRole("button", { name: "no", exact: true }).click();
  await page.getByPlaceholder("50 123 4567").fill("501234567");
  await waitForProgressSave(page, (body) => body.includes('"newToKeeta":"no"'));

  const token = new URL(page.url()).hash.replace("#resume=", "");
  const drafted = await fakeState(page);
  const draftCart = draftObjects(drafted).find(([key]) => key.endsWith("/cart.png") || key.includes("/cart."));
  expect(draftCart).toBeDefined();
  // The phone number was typed before the reload and never reached the draft.
  expect(JSON.stringify(drafted.tables.wizard_drafts)).not.toContain("501234567");

  // URL only: no storage, no cookies.
  const rebuilt = await rebuildTab(page, { dropCookies: true });
  const rebuiltRequests = recordRequests(rebuilt);
  await expect(rebuilt.getByRole("button", { name: /Get a Keeta price/ })).toBeVisible();
  await expect(rebuilt.getByPlaceholder("50 123 4567")).toHaveValue("");
  await rebuilt.getByPlaceholder("50 123 4567").fill("501234567");

  const submitted = rebuilt.waitForResponse((response) => response.url().endsWith("/api/submissions"));
  await rebuilt.getByRole("button", { name: /Get a Keeta price/ }).click();
  const response = await submitted;
  expect(response.status()).toBe(201);
  await expect(rebuilt).toHaveURL(/\/r\//);
  expect(rebuilt.url()).not.toContain(token);

  const after = await fakeState(rebuilt);
  const submission = after.tables.submissions?.[0];
  expect(submission).toBeDefined();
  expect(submission.checkout_image_path).toMatch(/^submissions\//);

  // The screenshot that was submitted is the one stored in the draft, byte for byte.
  const stored = after.objects[`submission-images/${submission.cart_image_path}`];
  expect(stored.base64).toBe(draftCart![1].base64);

  // And the draft is gone - row and files - now that the order is in.
  expect(after.tables.wizard_drafts ?? []).toHaveLength(0);
  expect(draftObjects(after)).toHaveLength(0);

  // The token never appeared in a request URL or a Referer, before or after.
  const all = [...requests, ...rebuiltRequests];
  expect(all.length).toBeGreaterThan(10);
  expect(all.some((request) => request.referer.includes("/compare"))).toBe(true);
  for (const request of all) {
    expect(request.url).not.toContain(token);
    expect(request.referer).not.toContain(token);
  }
});

test("a tab that lost its URL fragment still resumes from the cookie", async ({ page }) => {
  await uploadCart(page);
  await goToConfirmAndChooseArea(page);

  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  const fresh = await page.context().newPage();
  await page.close();
  await fresh.goto("/compare");

  await expect(fresh.getByRole("button", { name: /Get a Keeta price/ })).toBeVisible();
  await expect(fresh.getByRole("button", { name: /View your cart screenshot full size/ })).toBeVisible();
  await expect(fresh).toHaveURL(/#resume=/);
});

test("a first visit with nothing to resume never waits on the draft API", async ({ page }) => {
  const requests = recordRequests(page);
  await page.goto("/compare");
  await expect(page.getByRole("button", { name: /Have a screenshot/ })).toBeVisible();
  expect(requests.some((request) => new URL(request.url).pathname.startsWith("/api/drafts"))).toBe(false);
});
