# FindFoodae

Before you order, check if you can save.

FindFoodae lets a Dubai food-delivery customer send the basket they are about to
order, and get back an answer: is the same order cheaper on another app?

**Phase 1 is deliberately manual.** A customer submits a cart screenshot, their
area, their app and their checkout total. An admin opens Keeta, rebuilds the same
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

The wordmark is **FindFoodae**, set as **FindFood** + **UAE** — the "ae" is the
UAE country code — with a golden rule under "Food". It lives in one place,
`components/customer/Wordmark.tsx`, and the strings come from
`lib/constants.ts` (`BRAND_NAME`, `WORDMARK_PRIMARY`, `WORDMARK_SUFFIX`).

Customer references are `FFA-YYMMDD-NNNN`. Palette and type are tokens in
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
2. Give it a name (e.g. `findfoodae`), set a database password, and pick a region
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

Open **SQL Editor → New query** in the Supabase dashboard and run these three
files **in order**, one at a time:

| Order | File | What it does |
| --- | --- | --- |
| 1 | `supabase/migrations/0001_initial_schema.sql` | Tables, constraints, indexes, `updated_at` trigger |
| 2 | `supabase/migrations/0002_row_level_security.sql` | `is_admin()` plus every RLS policy |
| 3 | `supabase/migrations/0003_storage.sql` | Creates the private bucket and its policies |

Each file is safe to run more than once.

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
-- expect: admin_profiles, areas, submission_events, submissions
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
EMAIL_FROM=FindFoodae <results@yourdomain.com>
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
RESEND_API_KEY      (optional)
EMAIL_FROM          (optional)
```

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
   empty → **Check my order**.
3. Choose **Al Karama**, choose **Talabat** → **Continue**.
4. Enter **82** → **Continue**. (The optional checkout screenshot lives on
   screen 1, alongside the required cart screenshot.)
5. Enter a WhatsApp number → **Continue**.
6. Review, then **Get a Keeta price**.
7. You land on the success screen with a reference like `FFA-260910-0042`.

**Admin:**

8. Sign in at `/admin/login`. The submission is at the top of the table.
9. Open it. You see Al Karama, Talabat, AED 82.00 and the cart screenshot
   (click to enlarge).
10. **Start review** → status becomes Reviewing.
11. Type **63** as the Keeta total. The card shows **AED 19.00 saving, 23.2%**
    live as you type.
12. **Save comparison & generate result** → status becomes Result Ready and the
    customer message appears.
13. **Open in WhatsApp** → the wa.me link carries the customer's number and the
    prefilled message.
14. **Mark as sent** → status becomes Sent, and the dashboard agrees.

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

The customer screens follow the FindFoodae mockup: numbered upload slots with
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

FindFoodae is an independent comparison service and is not affiliated with
Talabat, Keeta, Careem, Deliveroo or Noon Food.
