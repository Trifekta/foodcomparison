# SnipSavor staging

A copy of SnipSavor that shares **nothing** with production: its own Cloudflare
Worker, its own Supabase project, its own secrets and its own URL. It exists so
that migrations, the `/api/v1` mobile API and anything else can be tried on real
Cloudflare and real Supabase without a customer, an admin phone or an advert
ever noticing.

| | Production | Staging |
| --- | --- | --- |
| Worker | `foodcomparison` | `foodcomparison-staging` |
| Wrangler target | top level of `wrangler.jsonc` | `env.staging` in `wrangler.jsonc` |
| Build command | `npm run cf:build` | `npm run cf:build:staging` |
| Deploy command | `npx wrangler deploy` | `npx wrangler deploy --env staging` |
| Supabase | production project | a separate staging project |
| URL | the live domain | `https://foodcomparison-staging.<account-subdomain>.workers.dev` |
| `SNIPSAVOR_ENV` | unset | `staging` (set by `wrangler.jsonc`) |
| Meta Pixel | the product's pixel | off (forced by the staging build) |

Nothing about production changed to make room for this. The only visible effect
is a Wrangler warning on a plain `wrangler deploy` that no environment was named;
it still deploys production, as before.

---

## How staging is kept away from production

The code is the same on both. What can go wrong is a value copied from the wrong
dashboard, so staging checks its values three times.

1. **`deploy/environments.json` names both sides.** Production's and staging's
   Supabase project ref and app origin: public identifiers, never keys. They are
   committed, so a change to them is reviewed like any other change. Blank
   entries fail every check below. A check that does not know what production
   looks like cannot refuse it.
2. **The staging build refuses production values** (`scripts/build-staging.mjs`,
   run by `npm run cf:build:staging`). Before `next build` starts, it checks:
   - `NEXT_PUBLIC_SUPABASE_URL` must be staging's project and must not be
     production's;
   - `NEXT_PUBLIC_APP_URL` must be staging's origin and must not be production's;
   - a legacy JWT anon key (or a service-role key, if one is present) must name
     the staging project;
   - no `.env`, `.env.local`, `.env.production` or `.env.production.local` may
     exist, because Next would read them and fill any gap with whatever they
     hold, which on a laptop is usually production;
   - the Meta Pixel is forced off. Unset, it would default to production's
     pixel and count staging visits against real adverts.
3. **The staging Worker refuses at runtime too** (`lib/env.ts`). The staging
   Worker carries `SNIPSAVOR_ENV=staging` from `wrangler.jsonc`, whatever build
   it runs. Before any Supabase client is created, it re-checks the baked-in
   Supabase URL, anon key and app URL, and the `SUPABASE_SERVICE_ROLE_KEY`
   secret. If anything belongs to production, it throws and makes no request, so
   a mistake stops staging working instead of writing to production. On
   production (`SNIPSAVOR_ENV` unset) this check does nothing.

`npm run check:staging-env` runs step 2's checks without building anything.

**Why `NEXT_PUBLIC_APP_URL` gets special attention.** It is fixed when the bundle
is built, in server code as well as in the browser. Setting it as a runtime
variable or secret on the Worker has no effect at all (confirmed on workerd).
If a staging build is made with production's value, every `resultUrl`,
`switchUrl`, logo and privacy link the `/api/v1` routes return points at the
live site. Staging's value must be a **build variable on the staging Worker**.

---

## 1. Fill in `deploy/environments.json`

Four public values, committed to the repository:

| Key | Where to find it | Example |
| --- | --- | --- |
| `production.supabaseProjectRef` | Production Supabase → Project Settings → General → Project ID (the `<ref>` in `https://<ref>.supabase.co`) | `abcdefghijklmnopqrst` |
| `production.appOrigin` | The live site's origin, no trailing slash or path | `https://snipsavor.com` |
| `staging.supabaseProjectRef` | The staging project's ID, once step 2 creates it | `tsrqponmlkjihgfedcba` |
| `staging.appOrigin` | The staging Worker's URL, once step 3 creates it | `https://foodcomparison-staging.yourteam.workers.dev` |

None of these is a secret: the project ref is part of every Supabase URL, and
the origins are web addresses.

## 2. Create the staging Supabase project (manual)

1. **Supabase dashboard → New project.** Name it `snipsavor-staging`. Use the same
   region as production, so latency behaves the same. Generate a **new**
   database password; never reuse production's. (The free plan allows two
   projects.)
2. **Project Settings → API.** Note the Project URL, the anon/publishable key and
   the service_role/secret key. They go into Cloudflare in step 3 and nowhere
   else.
3. **SQL Editor: run every file in `supabase/migrations/` in filename order**,
   `0001` through `0030`, one at a time. The two `0023_*` files run in name
   order: `0023_landing_cta_events.sql`, then `0023_visitor_ips_audit.sql`.
   Every file is safe to re-run.
   - Do not use `supabase db push` from a machine whose CLI has ever been linked
     to production. `supabase link` remembers the last project, and a push to
     the wrong one cannot be taken back.
4. **Seed the areas.** Run `supabase/seed.sql`, then run
   `0017_uae_areas.sql` once more. Both are safe to re-run, and this matches the
   order the main README describes. `supabase/seed_dev_submissions.sql` is
   allowed on staging (fake data) but not needed.
5. **Storage.** Confirm a **private** bucket named `submission-images` exists
   (migration `0003` creates it).
6. **Authentication → URL Configuration.** Set **Site URL** to the staging app
   origin.
7. **Create a staging admin.** Authentication → Users → Add user, tick
   **Auto Confirm**, and use a password that is **not** any production admin's.
   Then, in the SQL Editor:
   ```sql
   insert into public.admin_profiles (id, display_name, role)
   values ('<new-user-uuid>', 'Staging admin', 'admin');
   ```
8. **Never copy production data into staging.** Screenshots hold customers'
   names and addresses. Staging data is test data only.

## 3. Create the staging Worker (manual, Cloudflare dashboard)

Create a **new** Worker. Do not add a "preview" or an environment to the
production Worker.

1. **Workers & Pages → Create → Import a repository.** Pick this repository and
   name the project **`foodcomparison-staging`**. The name must match
   `env.staging.name` in `wrangler.jsonc`, or Workers Builds rejects the deploy.
2. **Settings → Build:**

   | Setting | Value |
   | --- | --- |
   | Build command | `npm run cf:build:staging` |
   | Deploy command | `npx wrangler deploy --env staging` |
   | Non-production branch deploy command | `npx wrangler versions upload --env staging` |
   | Production branch | `staging` (a branch you fast-forward when you want staging updated) |

3. **Settings → Build → Variables** (build variables, read by `next build`):

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<staging-ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the staging project's anon/publishable key |
   | `NEXT_PUBLIC_APP_URL` | `https://foodcomparison-staging.<account-subdomain>.workers.dev` (exactly `staging.appOrigin`) |

   Do not set `NEXT_PUBLIC_META_PIXEL_ID`; the staging build switches it off
   itself.
4. **Settings → Variables and Secrets** (runtime, read on every request). Add
   these as **Secret**, for the reasons in the main README:

   | Name | Type | Staging value |
   | --- | --- | --- |
   | `SUPABASE_SERVICE_ROLE_KEY` | Secret | the **staging** project's service_role/secret key. Required. |
   | `CRON_SECRET` | Secret | a **new** long random string, not production's. Required for the 5-minute cron (chaser, draft pruning). |
   | `MOBILE_MIN_VERSION_ANDROID` | Variable | e.g. `1.5.0` for testing the upgrade gate; blank allows every build |
   | `MOBILE_MIN_VERSION_IOS` | Variable | e.g. blank, or deliberately malformed to test that it fails open |
   | `ANTHROPIC_API_KEY` | Secret | optional. A **separate** key with a low spend limit, or leave unset (screenshot reading is then off). |
   | `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | Secret | leave **unset**, or use a staging-only chat. Never production's chat: every staging submission would alert the real admins. |
   | `WEB_PUSH_PUBLIC_KEY` / `WEB_PUSH_PRIVATE_KEY` / `WEB_PUSH_SUBJECT` | Secret | leave unset, or generate a **new** pair with `npm run push:keys` |
   | `DRAFT_RESUME` | Variable | `off` |
   | `EXTRACTION_MODEL`, `KEETA_ALLOWED_HOSTS` | Variable | leave unset (defaults) |

   Do **not** add `SNIPSAVOR_ENV` in the dashboard. `wrangler.jsonc` sets it on
   every deploy. And never add it to the production Worker.
5. **Deploy** by pushing to the staging Worker's production branch (`staging`).
   `npm run cf:deploy:staging` from a clean checkout also works, runs the same
   checks, and targets only `foodcomparison-staging`.

## 4. After the first deploy: confirm isolation

- `GET <staging>/api/v1/config` with header `X-SnipSavor-Client: android/1.0.0`:
  every URL in the response starts with the staging origin.
- The staging Worker's logs show no `Staging isolation check failed` lines.
- A test submission appears in the **staging** Supabase `submissions` table and
  not in production's.
- View the page source of `<staging>/compare`: it contains no
  `connect.facebook.net`.

---

## Things never to do

- **Never test on the production Worker's preview URLs.** If the production
  Worker has "builds for non-production branches" enabled, pushing a branch
  uploads a preview version of **production**, with production's secrets and
  production's build variables. Test data sent there lands in the live
  database. Only `foodcomparison-staging` is staging.
- **Never put a production key, password, chat id, VAPID pair or cron secret on
  the staging Worker**, even temporarily.
- **Never run `npm run cf:build` for staging.** It skips every check above.
- **Never commit a key or secret to `deploy/environments.json`.** It holds
  identifiers only.

---

## What the Claude Code session needs for staging validation

Deploying stays with you, through Workers Builds or `npm run cf:deploy:staging`.
A Cloudflare API token cannot be limited to a single Worker, so a token able to
deploy staging could also deploy production. The session therefore does not ask
for one.

Add these in the cloud environment's settings (environment menu → Edit), never
in chat:

| Environment variable | Value | Used for |
| --- | --- | --- |
| `STAGING_APP_URL` | the staging origin | calling `/api/v1` and the website on the real Worker |
| `STAGING_SUPABASE_URL` | `https://<staging-ref>.supabase.co` | checking rows the tests wrote, then deleting them |
| `STAGING_SUPABASE_SERVICE_ROLE_KEY` | the staging service-role key | the same, through the REST API |
| `STAGING_DATABASE_URL` | optional: the staging Postgres connection string (Project Settings → Database) | running and inspecting migration `0030` with `psql` |

Network access (same settings page): allow the staging Worker's host
(`foodcomparison-staging.<account-subdomain>.workers.dev`) and
`<staging-ref>.supabase.co`. If `STAGING_DATABASE_URL` is given, also allow its
database or pooler host. That connection is Postgres, not HTTPS, and the
environment's proxy may still refuse it. In that case, run `0030` in the SQL
Editor yourself and the session verifies it through the REST API instead.
