# SnipSavor

Before you order, check if you can save.

SnipSavor lets a Dubai food-delivery customer send the basket they are about to
order, and get back an answer: is the same order cheaper on another app?

**Phase 1 is deliberately manual.** A customer uploads a cart screenshot; their
own phone reads it and fills in a basket they check and correct. An admin then
opens the comparison app, rebuilds that basket by hand, and types the total.
Nothing is scraped, no platform APIs are called, and the customer-side reading
costs nothing and sends the screenshot nowhere. An admin opens Keeta, rebuilds the same
basket by hand, types the total, and the system does the rest — calculates the
saving, writes the customer message, and hands the admin a prefilled WhatsApp
link. Nothing is scraped, no platform APIs are called, and no AI reads the
screenshots.

The MVP exists to answer four questions:

1. Will customers upload their cart?
2. Can we regularly find meaningful savings?
3. Will customers switch apps because of the recommendation?
4. Will they come back?

---

## Contents

- [Stack](#stack)
- [Quick start](#quick-start)
- [1. Create the Supabase project](#1-create-the-supabase-project)
- [2. Run the migrations](#2-run-the-migrations)
- [3. Create the storage bucket](#3-create-the-storage-bucket)
- [4. Seed the Dubai areas](#4-seed-the-dubai-areas)
- [5. Create the first admin](#5-create-the-first-admin)
- [6. Environment variables](#6-environment-variables)
- [7. Run locally](#7-run-locally)
- [8. Deploy](#8-deploy)
- [Testing](#testing)
- [Acceptance walkthrough](#acceptance-walkthrough)
- [How it is put together](#how-it-is-put-together)
- [Reading the screenshot](#reading-the-screenshot)
- [Security model](#security-model)
- [Screenshot retention](#screenshot-retention)
- [Design notes](#design-notes)
- [What comes next](#what-comes-next)

---

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js (App Router) + React + TypeScript |
| Styling | Tailwind CSS |
| Database | Supabase Postgres |
| File storage | Supabase Storage (private bucket) |
| Admin auth | Supabase Auth (email + password) |
| Validation | Zod (shared between browser and server) |
| Forms | React Hook Form |
| Icons | Lucide React |
| Type | Plus Jakarta Sans (self-hosted via `next/font`) |
| Tests | Vitest |
| Hosting | Cloudflare Workers (via OpenNext) or Vercel |

Dependencies are kept lean on purpose. Email (Resend) is optional and the app
works fully without it.

### Brand

The wordmark is **SnipSavor**, set as **Snip** + **Savor** with a golden rule
under "Savor". It lives in one place, `components/customer/Wordmark.tsx`, and
the two halves come from `lib/constants.ts` (`BRAND_NAME`, `WORDMARK_PRIMARY`,
`WORDMARK_ACCENT`). The component reads those constants rather than slicing the
brand name, so renaming the product again means editing `lib/constants.ts` and
nothing else.

Customer references are six characters from a confusable-free alphabet — see
`lib/utils/reference.ts`. Palette and type are tokens in
`app/globals.css`: golden yellow `--color-brand-400` for primary actions,
near-black `--color-ink-900` for text and high-emphasis buttons, green for
savings, white ground.

---

## Quick start

```bash
npm install
cp .env.example .env.local     # then fill in the Supabase values
npm run dev
```

You still need a Supabase project — the steps below take about ten minutes.

---

## 1. Create the Supabase project

1. Go to <https://supabase.com/dashboard> and click **New project**.
2. Give it a name (e.g. `snipsavor`), set a database password, and pick a region
   close to your users — **Central EU (Frankfurt)** or **Asia (Singapore)** are
   both reasonable for Dubai.
3. Wait for provisioning to finish (a minute or two).
4. Open **Project Settings → API** and keep this tab open. You need:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

> The service_role key bypasses all database security. It is server-only. Never
> prefix it with `NEXT_PUBLIC_`, never paste it into client code, and never commit
> it.

---

## 2. Run the migrations

Open **SQL Editor → New query** in the Supabase dashboard and run these nine
files **in order**, one at a time:

| Order | File | What it does |
| --- | --- | --- |
| 1 | `supabase/migrations/0001_initial_schema.sql` | Tables, constraints, indexes, `updated_at` trigger |
| 2 | `supabase/migrations/0002_row_level_security.sql` | `is_admin()` plus every RLS policy |
| 3 | `supabase/migrations/0003_storage.sql` | Creates the private bucket and its policies |
| 4 | `supabase/migrations/0004_cart_items.sql` | Adds `submissions.restaurant_name` and the optional `submission_items` table |
| 5 | `supabase/migrations/0005_item_prices.sql` | Adds row prices and where each row came from |
| 6 | `supabase/migrations/0006_extractions.sql` | The extraction audit trail (`submission_extractions`) |
| 7 | `supabase/migrations/0007_result_link.sql` | `submissions.result_token` and `comparison_url` — the customer's result page |
| 8 | `supabase/migrations/0008_unavailable_outcome.sql` | The `unavailable` status and `unavailable_reason` |
| 9 | `supabase/migrations/0009_admin_submission_management.sql` | `archived_at`, the admin delete policy, and the new audit event types |

Each file is safe to run more than once.

> **Run every one of them.** `0007` and `0008` add columns rather than tables,
> and the code writes `result_token` on every single submission. Skip them and
> the app deploys, the wizard runs, and then every submission fails at the last
> step with "We couldn't submit your order" — which is why the check below looks
> at columns and not only at table names.

If you prefer the CLI:

```bash
npm install -g supabase
supabase link --project-ref <your-project-ref>
supabase db push
```

**Check it worked** — run this in the SQL editor:

```sql
select table_name from information_schema.tables
where table_schema = 'public' order by 1;
-- expect: admin_profiles, areas, submission_events, submission_extractions,
--         submission_items, submissions
```

Then check the columns the later migrations add, which a table list cannot show:

```sql
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'submissions'
  and column_name in ('result_token', 'comparison_url', 'unavailable_reason', 'archived_at')
order by 1;
-- expect all four: archived_at, comparison_url, result_token, unavailable_reason
-- anything missing means 0007, 0008 or 0009 has not been run
```

---

## 3. Create the storage bucket

`0003_storage.sql` already creates it. Confirm under **Storage** that a bucket
named **`submission-images`** exists and is **not public**.

If you would rather create it by hand: **Storage → New bucket**, name
`submission-images`, leave "Public bucket" **off**, set the file size limit to
10 MB, and allow only `image/jpeg`, `image/png`, `image/webp`. Then still run
`0003_storage.sql` for the access policies.

Screenshots are never public. Admins view them through signed URLs that expire
after ten minutes.

---

## 4. Seed the Dubai areas

Run `supabase/seed.sql` in the SQL editor. It inserts the launch list of 47 Dubai
areas and is safe to re-run.

Areas are data, not code — once the app is running you add, rename, reorder and
deactivate them at **/admin/areas** with no deploy.

**Optional (development only):** `supabase/seed_dev_submissions.sql` adds three
example submissions so the dashboard is not empty. Contact details in it are
fake, and the image paths point at nothing, so those rows show
"screenshot is no longer available" — that is expected. Do not run it on
production.

---

## 5. Create the first admin

Signing up is not enough. A user reaches the dashboard only if they also have a
row in `admin_profiles`, which is what the RLS policies check.

1. **Authentication → Users → Add user → Create new user.**
2. Enter the admin's email and a strong password, and tick **Auto Confirm User**.
3. Copy the new user's UUID.
4. Run this in the SQL editor, with your values:

```sql
insert into public.admin_profiles (id, display_name, role)
values ('<paste-the-user-uuid>', 'Your Name', 'admin');
```

To add more admins later, repeat steps 1–4. There is intentionally no way to
grant admin access from inside the app — that write is blocked by RLS, so a
compromised admin session cannot create more admins.

---

## 6. Environment variables

Copy `.env.example` to `.env.local` and fill it in:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional — leave blank and the dashboard falls back to "Copy email message"
RESEND_API_KEY=
EMAIL_FROM=SnipSavor <results@yourdomain.com>

# Optional — leave blank and the confirm step starts empty instead of pre-filled
ANTHROPIC_API_KEY=
EXTRACTION_MODEL=
```

`.env.local` is git-ignored. Never commit real credentials.

---

## 7. Run locally

```bash
npm install
npm run dev          # http://localhost:3000
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |
| `npm test` | Vitest suite |
| `npm run cf:build` | Build the Cloudflare Worker bundle into `.open-next/` |
| `npm run cf:preview` | Build and run the real Worker locally on workerd |
| `npm run cf:deploy` | Build and deploy to Cloudflare |

Routes:

| Route | Who | What |
| --- | --- | --- |
| `/` | Customer | Landing page |
| `/compare` | Customer | The submission wizard |
| `/success` | Customer | Reference number confirmation |
| `/privacy` | Public | Privacy notice |
| `/admin/login` | Admin | Sign in |
| `/admin` | Admin | Dashboard: cards, filters, submissions table |
| `/admin/submissions/[id]` | Admin | The comparison workflow |
| `/admin/analytics` | Admin | Validation metrics |
| `/admin/areas` | Admin | Manage Dubai areas |

---

## 8. Deploy

The repository is configured for **Cloudflare Workers** (`wrangler.jsonc` +
`open-next.config.ts`). Vercel also works with no changes — see below.

### Cloudflare Workers

The Worker name in `wrangler.jsonc` **must match the Worker in your Cloudflare
account**. It is currently `foodcomparison`. If you rename the Worker, change
that `name` too, or the deploy is rejected.

**1. Workers Builds settings** (Workers & Pages → your Worker → Settings →
Build):

| Setting | Value |
| --- | --- |
| Build command | `npm run cf:build` |
| Deploy command | `npx wrangler deploy` |

`cf:build` runs `opennextjs-cloudflare build`, which runs `next build` itself
and then bundles the Worker into `.open-next/`. Leaving the build command as
plain `npm run build` also works but builds Next.js twice.

**2. Build variables** — Settings → Build → Variables. These are inlined into
the bundle at build time, so they **must** be set here, not only as secrets:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_APP_URL
```

**3. Secrets** — Settings → Variables and Secrets, added as **Secret**, not
plain text. These are read at runtime, and the OpenNext adapter copies Worker
bindings into `process.env` on each request:

```
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY   (optional - reads the cart screenshot)
RESEND_API_KEY      (optional)
EMAIL_FROM          (optional)
```

`EXTRACTION_MODEL` is a plain build/runtime variable, not a secret - set it only
if you want something other than the default.

You can also set them from the CLI:

```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

**4. Deploy**, then set your custom domain under the Worker's **Domains &
Routes**.

**5. In Supabase**, go to **Authentication → URL Configuration** and set the
**Site URL** to your deployed domain.

To build and run the Worker locally before pushing:

```bash
npm run cf:preview          # builds and serves the real Worker on workerd
npx wrangler deploy --dry-run   # validates config and bindings, deploys nothing
```

Local Worker runs read secrets from a `.dev.vars` file (git-ignored) in the same
`KEY=value` format as `.env.local`.

#### Notes specific to Workers

- **`esbuild` is a deliberate direct devDependency — do not remove it.** Nothing
  in this codebase imports it. `@opennextjs/cloudflare` does, from
  `dist/cli/build/bundle-server.js`, but never declares it in its own
  `dependencies` or `peerDependencies`. It therefore only resolves if some other
  package happens to hoist a copy to the top of `node_modules`, and which copy
  wins that slot varies between `npm install`, `npm ci` and npm versions — three
  different esbuild versions compete for it here (via `@opennextjs/aws`,
  `wrangler` and `vite`). On Cloudflare's builder none was resolvable and the
  build died with `Cannot find package 'esbuild'`. Declaring it directly pins one
  copy at the root on every machine. The version must stay in `^0.28`: `vite`
  declares a peer range of `^0.27 || ^0.28`, and pinning lower makes `npm ci`
  fail with ERESOLVE.
- **Blocked install scripts are fine.** Cloudflare's builder warns that
  `esbuild`, `workerd` and `unrs-resolver` have postinstall scripts it will not
  run. Verified that esbuild still works with `--ignore-scripts`: modern versions
  get their binary from the `@esbuild/<platform>` optional dependency rather than
  a postinstall download.


- **No `WORKER_SELF_REFERENCE` binding.** OpenNext's scaffolder adds one to
  drive the ISR revalidation queue. This app has no ISR — every customer and
  admin route is `force-dynamic` and the static pages come from Workers Assets —
  so the binding is omitted. It is also impossible to create on a Worker's first
  deploy, since a Worker cannot bind to itself before it exists. If you add ISR
  later, add the binding *and* deploy once without it first.
- **Middleware is experimental on Workers.** OpenNext prints a warning for
  `proxy.ts`. Its matcher is `/admin/:path*` only, so the customer journey —
  landing, wizard, `/api/submissions`, success — never runs through it. It
  refreshes admin session cookies and redirects anonymous visitors; every admin
  page independently calls `requireAdmin()`, and RLS is the real enforcement, so
  deleting `proxy.ts` is a safe fallback if it ever misbehaves.
- **Rate limiting is weaker here.** `lib/utils/rate-limit.ts` keeps counters in
  memory, and Workers spreads requests across many short-lived isolates, so the
  limit is best-effort at best. Move it to KV or a Durable Object if abuse
  becomes real.

### Vercel

1. **Add New → Project**, import the repository. Vercel detects Next.js; leave
   the build settings alone (`npm run build` is plain `next build`).
2. Under **Settings → Environment Variables**, add all five variables from
   `.env.local` to **Production** (and Preview, if you use it). Set
   `NEXT_PUBLIC_APP_URL` to your real domain.
3. **Deploy**, add your domain under **Settings → Domains**, and set the
   Supabase **Site URL** as above.

The Cloudflare files are inert on Vercel, and `next.config.ts` only loads the
adapter in development.

After deploying, sign in at `https://your-domain/admin/login` and walk the
acceptance list below.

---

## Testing

```bash
npm test
```

The suite covers the parts where a bug costs money or leaks data:

- **Saving maths** — the worked example (82.00 − 63.00 = 19.00, 23.2%), the
  no-saving case, equal totals, and that a saving is never negative.
- **Money** — integer-fils arithmetic, so `10.30 − 10.10` is exactly `0.20`.
- **Validation** — invalid AED amounts, contact-method rules, the "Other" app
  rule, and that a missing checkout screenshot never blocks a submission.
- **Image safety** — magic-byte detection; an executable or HTML file renamed
  `cart.png` with `Content-Type: image/png` is rejected, as is an SVG.
- **Phone normalisation** — `050 123 4567`, `+971 50 123 4567` and
  `00971501234567` all normalise to `+971501234567`.
- **Result messages** — both templates, and that a WhatsApp link round-trips the
  message intact.
- **Admin authorisation** — a signed-in user without an `admin_profiles` row is
  redirected, not admitted.
- **Reference numbers** — format and uniqueness spread.
- **Analytics** — `saving_found` is `comparison_total < current_total`, averages
  cover only the comparisons where a saving was found, and empty data does not
  divide by zero.
- **No fake integrations** — the manual comparison provider refuses every
  automated lookup rather than returning invented data.

The database rules were verified separately against Postgres 16: every check
constraint rejects what it should (negative totals, totals over AED 5000,
negative savings, a contact type with no contact, `Other` with no app name,
unknown statuses, duplicate references), RLS returns zero rows to anonymous and
non-admin sessions, and an admin cannot grant admin rights from inside the app.

---

## Acceptance walkthrough

**Customer (do this on a phone):**

1. Open the homepage, tap **Check my order**.
2. Upload a cart screenshot into slot 1; leave slot 2 (marked **Optional**)
   empty → **Continue**.
3. The restaurant, items and prices are already filled in — your phone read them
   off the screenshot. Correct anything wrong, delete what you do not want, then
   **Continue**. (No key needed: this step costs nothing and sends nothing.)
4. Choose **Al Karama**, choose **Talabat** → **Continue**.
5. Tap **Use this** to take the total read off your screenshot, or type **82** →
   **Continue**.
6. Enter a WhatsApp number → **Continue**.
7. Review, then **Get a Keeta price**.
8. You land on the success screen with a reference like `K7M2PQ`.

**Admin:**

9. Sign in at `/admin/login`. The submission is at the top of the table.
10. Open it. You see Al Safadi, Al Karama, Talabat, AED 82.00, whatever items
    the customer listed, and the cart screenshot (click to enlarge).
    With a key configured, press **Extract basket**: the screenshot is read in
    your browser, the text is structured, and the result appears for you to
    correct. Nothing is stored until you press **Confirm and save basket**.
11. **Start review** → status becomes Reviewing.
12. Type **63** as the Keeta total. The card shows **AED 19.00 saving, 23.2%**
    live as you type.
13. **Save comparison & generate result** → status becomes Result Ready and the
    customer message appears.
14. **Open in WhatsApp** → the wa.me link carries the customer's number and the
    prefilled message.
15. **Mark as sent** → status becomes Sent, and the dashboard agrees.

**No-saving case:** submit another order with a total of **AED 50**, enter a
Keeta total of **AED 54**. The system must not claim a saving — it shows
"No cheaper option found on Keeta." and generates the no-saving message.

---

## How it is put together

```
app/
  page.tsx                     landing
  compare/page.tsx             loads areas server-side, renders the wizard
  success/page.tsx             reference confirmation
  privacy/page.tsx
  api/submissions/route.ts     the only public write endpoint
  admin/
    login/page.tsx
    (protected)/               everything behind requireAdmin()
      page.tsx                 dashboard
      submissions/[id]/page.tsx
      areas/page.tsx
      analytics/page.tsx
components/
  customer/                    wordmark, disclaimer, success burst
  customer/wizard/             one step per file, plus the orchestrator
  admin/                       comparison panel, result panel, table, filters
  forms/                       image upload, area combobox, amount input
  ui/                          button, card, badge, field error
lib/
  calculations/                money, saving, analytics  ← the business rules
  validation/                  Zod schemas + image magic-byte checks
  notifications/               message templates, WhatsApp links, providers
  comparison/                  provider + cart-parser interfaces (manual only)
  supabase/                    server, service-role and auth helpers
  admin/                       admin queries and server actions
  utils/                       phone, reference, status, text, rate limit
supabase/migrations/           the SQL you run, in order
types/                         database row types
proxy.ts                       refreshes admin sessions, blocks /admin early
wrangler.jsonc                 Cloudflare Worker name, flags and asset binding
open-next.config.ts            OpenNext adapter config (no ISR cache needed)
```

**Where the business rules live.** `lib/calculations/saving.ts` is the only place
savings are computed. The admin's live preview, the persisted columns, the
generated customer message and the analytics all call it. Money is parsed into
integer fils and only formatted back at the edges, so currency arithmetic never
touches a float.

**Server components by default.** The customer wizard, the comparison panel and
the filter bar are client components because they genuinely need interactivity.
Everything else renders on the server.

---

## Reading the screenshot

Two separate things share the name, and they work differently on purpose.

### The customer's phone reads it, for free

When a customer picks their cart screenshot, tesseract.js reads the text off it
**in their own browser**, and `lib/extraction/parse-text.ts` turns that text into
a basket with rules - no model, no API, no account, no cost, and the image never
leaves the device. The confirm step arrives filled in with the restaurant, the
items, the quantities and the row prices, plus the subtotal, fees, discount and
total read off the receipt. Everything is editable, because the read is rough
and the screen exists to be corrected.

The parser is deliberately not per-app. There is no Talabat branch and no Careem
branch; it leans on the one thing every receipt does - a price sits on the line
of whatever it is the price of - plus English and Arabic keywords for the fee
and total rows. A layout that defeats it should be fixed by the customer and
noticed in the numbers, not patched with a special case per brand.

Two things that look like details and are not:

- **OCR reads the original file, not the upload.** Uploads are downscaled and
  re-encoded as JPEG; those artifacts wreck small print and Arabic. Reading the
  original was worth both accuracy and speed - Arabic went from unreadable to
  correct, and the read got faster.
- **The total is never filled in silently.** It is the baseline for the saving
  we quote back, so the total step offers what was read behind an explicit
  "use this" tap.

The engine's WASM and language files are served from `/tesseract` on our own
origin, copied out of `node_modules` at build time by
`scripts/copy-ocr-assets.mjs`. tesseract.js would otherwise fetch them from a
public CDN, which would undercut "nothing leaves the device".

**Customers load English only; staff load Arabic too.** The language files
dominate the download - Arabic is 1.6 MB - and ad traffic is overwhelmingly
English-speaking. A single-script model is also faster. An Arabic screenshot on
the customer side therefore reads as noise, which the customer deletes; staff
still have Arabic for exactly those cases.

The engine starts downloading when the upload step appears, not when a file is
chosen, so most of it arrives while the customer is in their photo gallery.

Measured, first visit, from choosing a photo to seeing the table:

| Connection | Time |
| --- | --- |
| Wifi / 5G | ~1s |
| 4G, 12 Mbps | ~5s |
| Slow 4G, 4 Mbps | ~18s |

About 4.3 MB over the wire, cached afterwards, so a second upload on the same
phone is 1-2s on any connection. Every visitor from an ad campaign is a first
visit, so the first-load row is the one that matters. If the funnel drops at
this step, that download is the first suspect - see the `$5` note under
**Cost and model** for the alternative that removes it entirely.

### Staff can ask a model, when a key is configured

With `ANTHROPIC_API_KEY` set, the admin submission page gains **Extract basket**.
OCR runs in the admin's browser and only the resulting text goes to Claude to be
structured - the image stays with us. **Use AI vision fallback** does send the
screenshot, behind its own confirmation, for when OCR has failed. Neither is
reachable from anything a customer does.

Without a key that panel says so and nothing else changes. The customer-side
read above works either way, because it uses no API at all.

`submission_extractions` records every staff run - raw OCR text, confidence,
engine, model, prompt version, timings, the structured result, errors - and the
submission is untouched until the admin presses **Confirm and save basket**.
Confirming replaces only rows a previous extraction created; the customer's own
items, `restaurant_name` and `current_total` are never overwritten.

### Measuring accuracy

```bash
npm run extract:eval -- eval/shots            # the OCR-plus-model route
npm run extract:eval -- eval/shots --vision   # the fallback, for comparison
```

Each screenshot needs a sibling `.json` naming the app and language and stating
what a human reads off the screen; the format is at the top of
`scripts/eval-extraction.mjs`. It reports restaurant accuracy, item recall and
precision, quantity, price and total accuracy - overall, per app and per
language. It needs an API key and costs one model call per screenshot.

`PROMPT_VERSION` in `lib/extraction/prompt.ts` is stored against every staff
extraction. Bump it whenever the prompt changes, or last month's measurement
cannot be compared with today's.

---

## Security model

Screenshots routinely show a customer's name, address and order history, so the
defaults are strict.

- **No public read path.** There is no API that lists or fetches submissions.
  `/api/submissions` accepts `POST` only; `GET` returns 405.
- **A reference number authorises nothing.** It is a label. The success page
  echoes it from the URL and performs no lookup, so guessing one reveals nothing.
- **Row Level Security on every table.** Anonymous users have no policy at all.
  A signed-in user reads submissions only with an `admin_profiles` row. Admin
  rows themselves cannot be created from inside the app.
- **Private storage.** The bucket is private; admins get signed URLs that expire
  after ten minutes.
- **Uploads are checked by content, not by name.** The server reads each file's
  magic bytes; anything that is not a real JPEG, PNG or WEBP is rejected, which
  keeps executables and script-capable SVGs out of storage.
- **Everything is validated twice.** The same Zod schemas run in the browser for
  fast feedback and again on the server, where they are the only ones trusted.
- **The service_role key never reaches the browser.** It is used in exactly two
  server modules, both marked `server-only`.
- **Admin routes are guarded server-side.** `proxy.ts` turns away anonymous
  requests early, and every protected page calls `requireAdmin()` during render.
- **Rate limiting.** The submission endpoint allows five submissions per client
  per ten minutes (in-memory, best effort — see `lib/utils/rate-limit.ts` for how
  to make it durable).
- **Consent is not bundled.** Submitting a comparison permits a reply about that
  request. `marketing_consent` is a separate column, defaults to false, and is
  only set by the customer ticking the box.
- **Logs stay clean.** Errors are logged without customer data.

---

## Screenshot retention

`SCREENSHOT_RETENTION_DAYS` in `lib/constants.ts` is 30. Automated deletion is
**not** implemented in the MVP. When you want it, the pieces are already in
place — paths are predictable (`submissions/{id}/cart.{ext}`) and the timestamps
are on the row:

1. Add a route such as `app/api/cron/prune-screenshots/route.ts` that:
   - selects submissions where `created_at < now() - interval '30 days'` and
     `cart_image_path is not null`;
   - calls `supabase.storage.from('submission-images').remove([...])` in batches;
   - nulls `cart_image_path` / `checkout_image_path` on those rows, keeping the
     comparison record for analytics.
2. Protect it with a shared secret header.
3. Schedule it in `vercel.json`:
   ```json
   { "crons": [{ "path": "/api/cron/prune-screenshots", "schedule": "0 2 * * *" }] }
   ```

The admin UI already handles a missing screenshot gracefully, so pruning old
images will not break old submissions.

---

## Design notes

The customer screens follow the SnipSavor mockup: numbered upload slots with
Uploaded / Optional state, a "Delivery area in Dubai" type-ahead, a review that
ends in a golden "Can Keeta beat AED X?" panel, and a yellow celebration on the
confirmation screen. The admin's verdict card is the same "Keeta beats the
price" layout the customer's message describes — struck-through competitor
price, large alternative price, green saving.

Two things in that mockup are **Phase 2**, and this build does not fake them:

- **Parsed order items.** The mockup shows the restaurant, each item and its
  price read off the screenshot. That needs vision-model parsing, which Phase 1
  explicitly excludes. Here the customer types the total, and the admin reads
  the screenshot. The seam is `CartParserService`.
- **An instant Keeta price.** The mockup's result screen implies a live Keeta
  lookup. Phase 1 has no Keeta integration: an admin rebuilds the basket by hand
  and the result reaches the customer by WhatsApp or email, not in-app. The seam
  is `DeliveryComparisonProvider`.

The checkout screenshot sits beside the cart screenshot on screen 1, as the
mockup shows, but stays clearly marked **Optional** — it buys a more accurate
comparison and never blocks a submission.

---

## Managing submissions

Four things an admin can do to a submission once it has arrived, all from the
dashboard or the submission's own page.

- **Edit** corrects what the customer sent: restaurant, area, the total they are
  paying, which app it came from, and how to reach them. Nothing the comparison
  derives is editable here — `saveComparison` owns the Keeta total, the saving
  and the message, and a second way to set those is how two numbers that should
  agree stop agreeing. Every edit appends a `submission_edited` event naming the
  fields that moved and their before and after.
- **Archive** takes a row out of the working list without losing it. It is a
  timestamp (`archived_at`), not a status, so an archived submission keeps
  whatever outcome it reached. Archived rows leave the list, the dashboard
  counts **and the validation metrics** — that last one is the point: archiving
  is how somebody says "this one was not real", so a test submission stops
  distorting the numbers the pilot is being judged on.
- **Delete** removes the row, its basket, its events, its extractions and its
  screenshots. `0002` deliberately gave submissions no delete policy; `0009`
  adds one, because archiving now covers "get this out of my way" and what is
  left is the case archiving cannot serve — a customer asking for their data to
  be removed. The screenshots go first: the database cascades its own tables but
  knows nothing about the bucket, so deleting the row first would strand a cart
  photo holding somebody's name and address. If the images cannot be deleted,
  nothing is.
- **Export** downloads the list as CSV, through `/admin/export`. It reads the
  same query string the dashboard does, via `lib/admin/filters.ts`, so the file
  holds exactly the rows on screen — up to 5000 rather than the table's 100,
  because an export that silently stops at 100 looks complete.

**Why CSV and not `.xlsx`.** Excel opens both; a real workbook writer is around a
megabyte, and the Worker is measured against a size limit the OCR assets already
eat into. The file carries a byte-order mark so Excel reads Arabic correctly,
quotes every field so an area name with a comma cannot shift a column, and
prefixes anything starting with `=`, `+`, `-` or `@` so a spreadsheet treats it
as text instead of a formula.

**No contact details are exported.** The file has the reference, timestamp,
status, area, app, totals, saving and which channel the customer chose — but not
their number or email. The export exists to be worked on in a spreadsheet, and
that is a much easier thing to forward than a dashboard behind a login.

---

## What comes next

The seams are in place; none of them are wired to anything yet, and none of them
fake a result.

- **AI cart parsing** — `lib/comparison/cart-parser.ts` defines
  `CartParserService`. The only implementation, `ManualCartParser`, reports
  `supported: false`. A vision-model parser slots in behind the same interface.
- **Keeta (and other) APIs** — `lib/comparison/types.ts` defines
  `DeliveryComparisonProvider` (`findRestaurants`, `getRestaurantMenu`,
  `calculateBasket`, `getPromotions`, `getDeliveryFee`, `getFinalEstimate`).
  `ManualComparisonProvider` throws `ManualComparisonRequired` from every lookup,
  so it can never be mistaken for a working integration. `KeetaProvider`,
  `TalabatProvider` and friends implement the same interface when the time comes.
- **Other notification channels** — `lib/notifications/provider.ts` defines
  `NotificationProvider`. Resend is one implementation; the WhatsApp Business API
  would be another.
- **Precise location** — `submissions.customer_latitude` / `customer_longitude`
  are nullable and unused. Phase 1 asks for an area, on purpose.

Deliberately **not** built: payments, subscriptions, customer accounts,
restaurant onboarding, a marketplace, ordering, scraping, browser automation,
OCR, recommendation engines, loyalty, referrals, push notifications, or any
market outside Dubai.

---

SnipSavor is an independent comparison service and is not affiliated with
Talabat, Keeta, Careem, Deliveroo or Noon Food.
