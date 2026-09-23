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
- [4. Seed the delivery areas](#4-seed-the-delivery-areas)
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

#### The icon

`app/icon.svg` is the mark and the only place it is drawn: the wordmark's **S**,
in Plus Jakarta Sans ExtraBold, inside the crop frame, on the brand gold. The
letter is a path rather than text so it renders where there is no webfont, which
is most of the places an icon turns up.

Every other size is rendered from it by `npm run icons`, and committed:

| File | Where it shows up |
| --- | --- |
| `app/icon.svg` | Browser tabs, at any size |
| `app/favicon.ico` | 16/32/48, for whatever asks for `/favicon.ico` by reflex |
| `app/apple-icon.png` | iOS Home Screen — full bleed, because iOS rounds it itself |
| `public/icons/icon-192.png`, `icon-512.png` | The manifest's icons |
| `public/icons/maskable-512.png` | Android, which crops to its own shape |
| `public/icons/badge.png` | The status-bar badge on a notification — alpha only |

Change `app/icon.svg`, run `npm run icons`, and read the diff. `app/manifest.ts`
names the icons, the app and the colours behind it, which is what a phone shows
when somebody adds this to their Home Screen.

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

Open **SQL Editor → New query** in the Supabase dashboard and run these thirteen
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
| 9 | `supabase/migrations/0009_funnel_events.sql` | `funnel_events` — where visitors stop, from the advert onwards |
| 10 | `supabase/migrations/0010_admin_submission_management.sql` | `archived_at`, the admin delete policy, the new audit event types, and the `landing_viewed` funnel step |
| 11 | `supabase/migrations/0011_funnel_area.sql` | `funnel_events.area_id` — which area a visit came from, once it says |
| 12 | `supabase/migrations/0012_push_subscriptions.sql` | `push_subscriptions` — browser push endpoints for customers and admins |
| 13 | `supabase/migrations/0013_chase_unanswered.sql` | `submissions.chased_at` — so a reminder is sent once, not every run |

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
-- anything missing means 0007, 0008 or 0010 has not been run

-- and the funnel table, added by 0009:
select to_regclass('public.funnel_events');  -- null means 0009 has not been run
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

## 4. Seed the delivery areas

Run `supabase/seed.sql` in the SQL editor for the 48 Dubai areas, then migration
`0017_uae_areas.sql` for the other 148 across the remaining emirates. Both are
safe to re-run.

The picker groups by `city` and Dubai sorts first, because that is where the ads
run. Everywhere else is listed so that a customer who hears about this from a
friend has somewhere to put themselves — being listed is not a promise of
coverage, and a basket that cannot be priced already has an honest answer.

Areas are data, not code — once the app is running you add, rename, reorder and
deactivate them at **/admin/areas** with no deploy, and the city you pick there
decides both the heading a customer sees and the emirate the funnel reports by.

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
| `npm run icons` | Re-render every app icon from `app/icon.svg` |
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
| `/admin/areas` | Admin | Manage delivery areas |

---

## 8. Deploy

The repository is configured for **Cloudflare Workers** (`wrangler.jsonc` +
`open-next.config.ts`). Vercel also works with no changes — see below.

### Cloudflare Workers

The Worker name in `wrangler.jsonc` **must match the Worker in your Cloudflare
account**. It is currently `foodcomparison`. If you rename the Worker, change
that `name` too, or the deploy is rejected.

**1. Deploys run from GitHub Actions** — the `deploy` job in
`.github/workflows/ci.yml`. A merge to the default branch runs lint, typecheck,
the tests and the Next build, and ships only if all four pass. `cf:build` runs
`opennextjs-cloudflare build`, which runs `next build` itself and then bundles
the Worker into `.open-next/`; `npx wrangler deploy` uploads it.

This replaces the **Cloudflare Workers Builds git integration**, which failed on
every pull request from the day it was connected — always in under a second,
which is to say it never got as far as running a build. Disconnect it in the
Cloudflare dashboard, or every merge builds twice and one of the two results is
noise.

Two credentials, under **Settings → Secrets and variables → Actions →
Secrets**:

```
CLOUDFLARE_API_TOKEN    a token with the "Edit Cloudflare Workers" template
CLOUDFLARE_ACCOUNT_ID
```

**2. Build variables** — the same screen, under **Variables**, not Secrets.
`next build` inlines these into the browser bundle, so they are public by
construction and the workflow reads them from `vars`:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_APP_URL
```

> **A build without these succeeds.** `lib/env.ts` defaults each one to `""`, so
> `next build` passes, `wrangler deploy` passes, the Worker starts, and the site
> cannot reach Supabase. The deploy job checks all five names before it builds
> and refuses rather than ship that.

**3. Runtime secrets** — on the Worker itself (Cloudflare dashboard → your
Worker → Settings → Variables and Secrets), added as **Secret**, not plain
text. These are read at runtime, and the OpenNext adapter copies Worker
bindings into `process.env` on each request.

> **Two different places, and only one of them is read while the site is
> running.** The build variables above live in GitHub and are baked into the
> bundle by `next build`, fixed for the life of that deployment. Everything
> below is looked up on every request and must be set on the **Worker itself**.
> Putting one in the wrong place fails silently in every direction: the build
> passes, the deploy passes, the site works, and the one feature that needed it
> is quietly switched off.
>
> `/admin/diagnostics` → **What this Worker can see** answers this directly,
> one line per name. It reads no values, only whether the name is visible.

> **Set runtime values as Secret, not as Variable.** Wrangler treats its config
> file as the source of truth and deletes plain-text variables it does not find
> there, so `wrangler deploy` — which runs on every merge — silently wiped every
> dashboard Variable. Secrets were never touched. `keep_vars: true` in
> `wrangler.jsonc` now stops the deletion, but Secret is still the right type for
> a private key.



```
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY   (optional - reads the cart screenshot)
```

`EXTRACTION_MODEL` is a plain runtime variable, not a secret. It defaults to
`claude-opus-5`, and it is the knob to turn when the bill is the problem: two
screenshots go to the model per submission, and the cost is dominated by the
image tokens, so the per-million input rate is very nearly the whole story.

| Model | Input $/MTok | Relative cost | Notes |
|---|---|---|---|
| `claude-opus-5` (default) | $5 | 1x | |
| `claude-sonnet-5` | $2 | ~0.4x | drop-in |
| `claude-haiku-4-5` | $1 | ~0.2x | no `effort` setting; the code omits it |

Changing it needs no deploy - it is read on every request. Measure before and
after with `npm run extract:eval`: a cheaper read that the customer has to
correct is not cheaper.

**Nothing tells you a customer is waiting until one of these is set too.** A
Worker with only the list above deploys, serves and takes orders perfectly, and
notifies nobody - `/admin/diagnostics` is where that shows up:

```
TELEGRAM_BOT_TOKEN     free, instant, two minutes - see .env.example for the
TELEGRAM_CHAT_ID       @BotFather steps. The quickest way to be told anything.
WEB_PUSH_PUBLIC_KEY    browser push. Generate a pair with `npm run push:keys`
WEB_PUSH_PRIVATE_KEY   or `npx web-push generate-vapid-keys`. Both must be set
WEB_PUSH_SUBJECT       or the Enable button never appears on the dashboard.
CRON_SECRET            any long random string you invent - it is a password
                       between the scheduler and the app, not something a
                       service issues. The Cron Trigger in wrangler.jsonc runs
                       every 5 minutes and does nothing until this is set.
```

One more, and it is not optional at launch even though it has a default:

```
KEETA_ALLOWED_HOSTS    EXACT hostnames /go/ may redirect to, comma-separated.
                       Not domains: "mykeeta.com" would not allow
                       url-eu.mykeeta.com. Defaults to the three Keeta serves
                       the UAE from, so most deployments need not set it.
```

Setting the push keys is not the last step: push is per device, so somebody
then has to open the dashboard **on the phone that should buzz** and press
*Enable new request notifications*. On an iPhone that button only exists in a
copy added to the Home Screen - iOS does not offer push to a Safari tab at all.

**The schedule is already configured.** `wrangler.jsonc` carries a Cron Trigger
every five minutes, and `worker/index.ts` wraps the Worker OpenNext generates to
add the `scheduled` export Cloudflare calls. Nothing outside Cloudflare has to
know the route exists, and there is no account anywhere else to keep alive.

Set `CRON_SECRET` on the Worker and it starts running. Without it the handler
logs `[cron] CRON_SECRET is not set` and returns — the route refuses every
caller, internal ones included, because one rule about who may run the chaser is
easier to be sure of than one rule with an exception.

The route stays open to an outside scheduler too (`X-Cron-Secret` header or a
bearer token), so an uptime monitor or cron-job.org still works if you ever want
the schedule to live somewhere Cloudflare cannot see.

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

## Notifications

Three things happen when a customer sends a basket, and only the first was ever
built: the result page polls itself, the admin gets a Telegram or email alert,
and — now — a browser push reaches whoever asked for one even with the tab shut.

**The page already polls and always did.** `ResultView` refreshes every 5s for
two minutes, then 15s, then 30s, pauses in a background tab, stops at a terminal
state and gives up after thirty minutes. Push is an addition for the customer
who closes the tab, not a replacement — and everything below is optional.

**Without `WEB_PUSH_*` keys the app behaves exactly as before.** No button
appears, nothing is stored, and the result still arrives on the page and in the
message the admin sends. Push failing can never fail a submission or a saved
comparison: every send is awaited only so its own errors get logged.

### Setting it up

```bash
npm run push:keys        # prints a VAPID pair (same format as web-push)
```

Put the three values in `.env.local`, and in production as Worker secrets:

```bash
npx wrangler secret put WEB_PUSH_PRIVATE_KEY
# WEB_PUSH_PUBLIC_KEY and WEB_PUSH_SUBJECT can be plain vars
```

The **private key never reaches the browser**. It is read only by
`getWebPushConfig()` in server code. The public half is read on the server too
and passed down as a prop, so no `WEB_PUSH_` value is ever inlined into the
client bundle.

### How it hangs together

| Piece | Where |
| --- | --- |
| VAPID + RFC 8291 encryption | `lib/push/crypto.ts` |
| Sending, and forgetting dead endpoints | `lib/push/send.ts` |
| Browser side: permission, subscribe | `lib/push/client.ts` |
| Service worker | `public/sw.js` |
| Customer registers | `POST /api/push/subscribe` (result token authorises it) |
| Admin registers | `subscribeAdminPush` server action (`requireAdmin`) |

**No `web-push` package.** It needs Node's `https` and crypto bindings, and this
runs on a Cloudflare Worker. Everything the protocol needs — ECDH on P-256,
HKDF, AES-GCM, ECDSA — is in Web Crypto, which Workers implement natively, so
the two RFCs are implemented directly. `tests/push.test.ts` plays the browser:
it keeps the private half of a subscription, runs the decryption backwards and
asserts the original payload comes back.

### What a notification may say

Nothing that identifies anybody. A notification is rendered by the operating
system, shows on a lock screen, and passes through a push service on the way —
so no name, number, address, restaurant or amount goes in one. The customer's
message says a result is ready; the admin's says a request arrived and, at most,
which area it came from. The numbers live behind the token in the link.

The customer's subscription is authorised by their result token, exchanged for
the submission id server-side so the row never stores the address of their page.
Admin subscriptions are tied to the signed-in account, never to anything the
browser claims — which is what stops a public client registering itself for
admin notifications.

Endpoints that answer 404 or 410 are deleted: that is a push service saying the
browser is gone, as opposed to a transient failure, which leaves the row alone.

### Chasing what nobody opened

Every other notification here fires at the moment something happens, which is
useless if nobody was looking. The alert that matters most — *an order has
arrived* — is the one most likely to be missed, because it lands while the admin
is doing something else, and the customer then sits out a five-minute promise
nobody knows they made.

`/api/cron/chase-submissions` asks the opposite question on a schedule: what is
**still** waiting. Anything `new`, not archived, and older than
`UNANSWERED_AFTER_MINUTES` (10 — twice the promise, so a reminder only arrives
when the promise is genuinely at risk) produces one notification to every
subscribed admin device and, if it is configured, a Telegram message.

One notification however many are waiting. Three orders at once is one thing to
go and do; three buzzes in a row is how somebody learns to ignore the buzzing.

Rows are marked `chased_at` **after** the send, not before — a reminder that
failed to go out should be retried on the next run rather than silently recorded
as done.

**Scheduling it.** The route takes a shared secret in `x-cron-secret` (or as a
bearer token, for schedulers that only offer `Authorization`). Without
`CRON_SECRET` set the route refuses everything and the feature is off: a chaser
anybody can trigger is a way to make somebody's phone buzz on demand. An
unauthorised call gets a 404, so nobody learns the route exists.

Call it every five minutes from whatever is easiest:

```bash
curl -H "x-cron-secret: $CRON_SECRET" https://your-domain/api/cron/chase-submissions
```

- **A free cron service** (cron-job.org, EasyCron) pointed at that URL — the
  quickest, and enough for a pilot.
- **Supabase `pg_cron` + `pg_net`**, if you would rather nothing outside the
  stack is involved. Both extensions are enabled from the Supabase dashboard.
- A Cloudflare **Cron Trigger** would need a `scheduled()` handler, which means
  wrapping the OpenNext worker entry point — a build step to own for one
  function, which is why a plain URL was chosen instead.

### Where the buttons are

- **Customer**: on the waiting screen, under the "we're comparing your basket"
  line. The permission prompt only ever comes from that tap — browsers refuse
  one no gesture asked for, and some count an unprompted request as a refusal
  they then remember. A refusal is final: no second banner.
- **Admin**: inside the existing alert panel on the dashboard, on its own line.
  Per device, so a phone and a laptop are two rows and both get notified.

### When nothing arrives

`/admin/diagnostics` has a **Browser notifications** section. It asks each of
the four things push needs separately — the table, the keys, whether any device
is registered, whether the chaser can run — and prints one sentence saying which
to fix first. Every one of them fails the same way otherwise: silence.

The likeliest answer is the third. The keys being set is not enough; somebody
has to open the dashboard on the device they want notified and press **Enable
new request notifications**. Until then `push_subscriptions` has no admin row
and `pushToAdmins` correctly does nothing.

**Send a test** on the dashboard goes down every configured channel, push
included, and repeats the push service's own words when it refuses. A 401 or 403
there means the private key on the server is not the pair of the public key the
browser subscribed with — after any key change, every device must subscribe
again.

A subscription also belongs to one **origin**. Moving the site to a new hostname
leaves every existing subscription behind on the old one.

### iPhone and Safari

iOS supports Web Push only for a site **added to the Home Screen**, from iOS
16.4 onwards. In a normal Safari tab the button will not appear at all, because
`pushSupported()` is false there — which is the correct outcome, not a bug. Those
customers keep the polling page, which is why it was left in place.

What that customer sees while adding it — the icon, the name under it, the
colour behind it as it opens — comes from `app/manifest.ts` and
`app/apple-icon.png`. Without them iOS falls back to a screenshot of the page,
which is the difference between an app and a bookmark at the exact moment
somebody decides whether to bother.

---

## Feeling like an app

The customer flow is one column, `max-w-md`, `min-h-dvh`, no navigation and no
footer menu - it was built that way. What was missing was the last inch:

`viewportFit: "cover"` in `app/layout.tsx` is the line that makes the rest work.
Without it iOS letterboxes the page inside the notch and home indicator and
**every `env(safe-area-inset-*)` reads zero** - so the safe-area padding already
written in `globals.css` was doing nothing at all. With it the page reaches the
physical edges, and the insets become real numbers the headers and the sticky
bars respect.

The primary action of each wizard step, and the "Open on Keeta" button, sit in a
**sticky** bar (`components/customer/wizard/StepActions.tsx`) - not a fixed one.
Fixed takes the bar out of the flow so it sits on top of content forever, and
fixed loses a fight with the iOS keyboard, which shrinks the visual viewport but
not the layout one. Sticky rides the bottom of the screen while there is more
below and comes to rest at its own place when the page ends.

`app/manifest.ts` and `app/apple-icon.png` make an installed copy open as an app
rather than a bookmark. The first click from an advert is the page, immediately -
nothing is asked of anybody before they have had anything.

There is exactly one place that mentions the Home Screen, and it is not an
install prompt. On the waiting screen the customer has just been told they will
be notified when their result is ready, and on an iPhone in Safari that promise
cannot be kept - Apple sends Web Push only to a Home Screen copy, so the
notification button renders nothing there. `AddToHomeScreen` is the missing half
of a promise already made, shown while it still changes what happens to *this*
order.

What it says depends on where they are, and the rules are in
`lib/pwa/install.ts`:

| Where | What they are told |
| --- | --- |
| Safari on iPhone | Share → Add to Home Screen |
| Instagram or Facebook on iPhone | Menu → Open in Safari → Add to Home Screen |
| Instagram or Facebook on Android | Menu → Open in Chrome. Nothing to install — Chrome does push in an ordinary tab |
| Anywhere push already works | Nothing |
| Any other embedded browser | Nothing — their menus are not something to give instructions about |

The iPhone-inside-Instagram route is three steps and says so. An instruction
with a missing step is one nobody finishes, and iOS sends push to a Home Screen
copy and to nothing else, so there is no shorter road to offer.

It is shown once. One tap on the dismiss and it never returns, on any route.

**During validation this matters more than it looks.** A result is produced by a
person and takes a few minutes, so the customer has genuinely closed the tab -
which makes this the difference between a result they see and one they miss.
The WhatsApp message the admin sends is the channel that works regardless, and
remains the thing to rely on.

Checked with a real browser at 360x800, 390x844, 393x852, 412x915 and 430x932 -
`npm run build`, serve, then drive Chromium over every customer page looking for
horizontal overflow and tap targets under 40px. That found twenty-one real
problems, all of them secondary links between 15px and 37px tall.

---

## Proving somebody switched

"Open on Keeta" is not a link to Keeta. It points at `/go/<token>`, which looks
up the comparison, checks the destination, writes a row, and forwards - so
"this customer saw this saving and then switched" is a record rather than an
inference from a funnel counter.

```
result page  ->  /go/<redirect_token>?v=<visit>  ->  keeta_clicks row  ->  Keeta
```

The token is **not** the result token. That one is the whole of the
authorisation for a customer's prices, and this one is designed to be followed
off-site, where it lands in another company's referrer header. A leaked `/go/`
link reveals nothing and grants nothing: the only thing it can do is redirect.

**It is not an open redirect.** `KEETA_ALLOWED_HOSTS` is the allowlist, and it
holds **exact hostnames, not domains** — allowing `*.mykeeta.com` would be a far
larger promise than the three addresses that actually serve restaurants here:

| Host | What it is |
| --- | --- |
| `url-eu.mykeeta.com` | what the Keeta app puts on the clipboard — the one an admin pastes |
| `m-eu.mykeeta.com` | where those links land, carrying `region=AE` |
| `fooddelivery1-eu.mykeeta.com` | likewise |

`keeta.com` and `keeta-global.com` are deliberately absent: the first is not
what the UAE app produces and the second is the corporate site. The `sailorc://`
app deep link is refused too — a scheme we do not control is not something to
hand a browser, and the https share link launches the app by itself.

It is checked **twice**. The admin form refuses to save a link the redirect
would refuse to follow, so a bad paste is caught while it is still on somebody's
clipboard; the redirect checks again, because a row can be written by something
other than that form and an allowlist that changes after a link was saved is
exactly what the later check is for. Anything else — including
`https://url-eu.mykeeta.com@evil.test/` and `https://url-eu.mykeeta.com.evil.test`
— lands on `/go/unavailable`. See `lib/keeta/destination.ts`.

**Where the customer came from travels with them.** Campaign parameters exist on
the first URL of a visit and nowhere else, so they are captured on arrival
(`lib/analytics/attribution.ts`), stored on the submission, and inherited by the
click. First touch wins, and the referrer is reduced to its origin — "which
site" is ours to know, "which page" is not. The `/go/` URL is never read for
them: it would be several navigations too late, and anybody could reassign a
click to any campaign by typing one.

```
Instagram ad 2  ->  landing  ->  screenshot sent  ->  result  ->  switched
utm_campaign=validation_week1, utm_content=ad2_new_user, fbclid=…
```

**A click is not an order.** Every row is switch intent and says so:
`conversion_status` starts at `unknown`, not `clicked`, because nothing has
looked for an order. `converted_at`, `keeta_order_id`, `order_value` and
`commission_value` are already columns, so wiring a Keeta referral callback
later is a route and not a migration.

Nothing may cost the customer their redirect. A failed write, a slow database
or a missing migration are all logged and forwarded anyway; the only thing that
stops a redirect is a destination we will not vouch for.

`/admin/attribution` reads it back: total taps, unique switchers, the
click-through rate against comparisons that had a button, and every click with
its restaurant, source app, prices, saving, area and click id.

**IDs are stored; names are looked up.** Meta's URL builder offers two macros
for the same field. `{{ad.id}}` writes `120249042878960301` into `utm_content`;
`{{ad.name}}` writes `Same Order Different Price`. The adverts built first used
the id form, so the admin tables read as eighteen-digit numbers and comparing
two creatives meant matching two of those against Ads Manager by eye.

The fix is a lookup, not a change to what is captured. `utm_campaign` and
`utm_content` still hold exactly what the advert sent, every report still groups
by those values, and the raw id stays under the name on every row — an id is a
stable key and a name is not, so a creative renamed in Ads Manager would
silently start a second row in every report if the name were the key.

Three things resolve a value, in order: a row an admin saved on
`/admin/ad-labels`, a default shipped in `lib/analytics/ad-labels.ts`, or — for
a value that was never an id — prettifying the slug, so `validation_week1`
reads as "Validation Week 1" with nothing registered at all. A bare id nothing
knows keeps its last six digits and is marked `unnamed`, so two unlabelled
creatives are still visibly two.

`/admin/ad-labels` also lists the values that have arrived on real visits and
have no name yet, so labelling a new creative is a tap rather than a hunt
through the tables for an unfamiliar number.

**For new adverts, set the name macros and skip all of this.** In Ads Manager,
set the tracking parameters to:

```
utm_source=instagram&utm_campaign={{campaign.name}}&utm_content={{ad.name}}
```

Meta then sends the names themselves and nothing needs labelling. Adverts
already running keep sending ids until their tracking parameters are edited, so
the saved labels still matter for them and for every visit already recorded.

---

## Sending the result as SnipSavor, not as a person

The result goes out over WhatsApp by hand: the admin opens a prefilled `wa.me`
link from the submission page and sends it. Which WhatsApp account that is
decides whether the customer hears from a brand or from a stranger.

**Use the free WhatsApp Business app on a second number.** It is an ordinary app,
not the API: the profile carries the SnipSavor name, logo and website, and it can
message anybody - the 24-hour window and the pre-approved templates are rules of
the WhatsApp Business *Platform*, which is a different product.

Nothing in this codebase changes for it. `wa.me` opens whichever WhatsApp the
device is signed into, so linking WhatsApp Business Web in the same browser as
the dashboard is the whole setup.

The message names SnipSavor in its first line for the same reason. It arrives
from a number the customer has never seen and the preview on their lock screen
is that line and nothing else - "we found a cheaper option" from an unknown
number reads like a scam.

---

## The five-minute promise

`RESULT_PROMISE_MINUTES` in `lib/constants.ts` is the single place the wait is
stated. It appears on the landing page, the upload step, the submit button and
the waiting screen, because the product only works before somebody orders — a
person deciding whether to wait needs a number, and with none on the screen they
assume the worst and order anyway.

The waiting screen also counts up (`Sent 3 minutes ago`) and, once the promise
is past, stops repeating it: "usually under 5 minutes" said in the seventh
minute is the one way to turn a short wait into a broken word. It changes to
"taking a little longer than usual" instead. There is deliberately **no
out-of-hours message** — every customer is told the same thing and gets the same
promise, whatever time they arrive.

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
  screenshots. `0002` deliberately gave submissions no delete policy; `0010`
  adds one, because archiving now covers "get this out of my way" and what is
  left is the case archiving cannot serve — a customer asking for their data to
  be removed. The screenshots go first: the database cascades its own tables but
  knows nothing about the bucket, so deleting the row first would strand a cart
  photo holding somebody's name and address. If the images cannot be deleted,
  nothing is.
- **Report** downloads the Validation page as CSV, through `/admin/report`, for
  whatever date range the picker on that page is set to — headline numbers, the
  funnel, and the breakdowns by area, app and reason, in one file. The page and
  the route read the range through the same parser, so the file and the screen
  can never cover different dates. Days are bounded in **Dubai** time: a
  submission at 1am Dubai on the 2nd is 9pm UTC on the 1st, and a daily report
  that put it in the wrong day would disagree with the dashboard it came from.
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
