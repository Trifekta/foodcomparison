# SnipSavor mobile apps: Flutter migration plan

Status: investigation only. Nothing here changes production behaviour.
Based on the repository at `6208e68` (main, after PR #103).

---

## 1. Current architecture

SnipSavor is a single Next.js 16 (App Router) application. The same app serves
the customer web flow, the admin dashboard and the JSON API. It runs on
Cloudflare Workers through OpenNext (`wrangler.jsonc`, `open-next.config.ts`,
`worker/index.ts`), with Supabase for the database and file storage.

```
Customer browser (anonymous, no account)
  /compare  ── CompareWizard (React client component, 2 steps)
     │  POST /api/extract        screenshot → Claude vision → basket JSON
     │     (fallback: tesseract.js in the browser + lib/extraction/parse-text.ts)
     │  POST /api/submissions    multipart: cart + checkout images + fields
     │  POST /api/events         funnel events + 20s heartbeats
     │  /api/drafts*             optional server-side wizard resume (DRAFT_RESUME flag)
     ▼
  /r/<result_token>  ── ResultView polls GET /api/result/<token>
     │  POST /api/push/subscribe  (Web Push, authorised by the result token)
     │  "Open on Keeta" → GET /go/<redirect_token>?v=<visit> → keeta_clicks row → 302 to Keeta
     ▼
Next.js route handlers / server actions (Cloudflare Worker)
     │  service-role Supabase client (lib/supabase/admin.ts) for all public writes
     │  cookie-based Supabase session for admins (lib/supabase/server.ts, proxy.ts)
     ▼
Supabase Postgres (RLS: anon has no access; authenticated only via is_admin())
Supabase Storage bucket `submission-images` (private; signed URLs for admins)
     ▼
External: Anthropic API (screenshot reading), Telegram (admin alerts),
Web Push services (VAPID, hand-rolled in lib/push/crypto.ts), Meta Pixel,
Keeta share links (allow-listed in lib/keeta/destination.ts), wa.me links.

Admin (Supabase Auth email+password, admin_profiles row required)
  /admin/**  dashboard, submission comparison page, analytics, live visits,
             areas, ad labels, attribution, diagnostics, CSV exports.
  Mutations are Next.js Server Actions (lib/admin/actions.ts,
  lib/extraction/actions.ts), not REST endpoints.
Cron (Cloudflare Cron Trigger every 5 min → worker/index.ts):
  /api/cron/chase-submissions, /api/cron/prune-drafts
```

The business flow is still **manual**: a customer submits a basket, an admin
rebuilds it on Keeta by hand, types the Keeta total and pastes the Keeta link
(`saveComparison` in `lib/admin/actions.ts`). The result page then shows the
saving (maths in `lib/calculations/saving.ts`, money in integer fils in
`lib/calculations/money.ts`) and the admin sends a prefilled WhatsApp message.

Key facts that shape the mobile plan:

| Area | What exists | Where |
| --- | --- | --- |
| Customer identity | **None.** Customers are anonymous. Identity = WhatsApp number (optional since 0028) + 6-char reference + 128-bit result token. | `lib/submissions/create.ts`, `lib/utils/reference.ts` |
| Admin auth | Supabase Auth email/password, cookie session via `@supabase/ssr`, `requireAdmin()` + RLS `is_admin()` | `lib/supabase/auth.ts`, `proxy.ts`, `supabase/migrations/0002_row_level_security.sql` |
| Customer "order history" | Only the last order, in the browser's `localStorage` | `lib/utils/last-order.ts`, `components/customer/LastOrderBanner.tsx` |
| Find an order | Reference + phone lookup, 10 tries / 10 min | `app/api/result/lookup/route.ts`, `lib/submissions/result.ts` |
| Points / loyalty / accounts / orders | **Nothing.** README "What comes next" lists them as deliberately not built. `keeta_clicks` has unused `converted_at`, `keeta_order_id`, `order_value`, `commission_value` columns. | `supabase/migrations/0014_keeta_click_attribution.sql` |
| Areas | 196 UAE areas in DB, admin-managed; passed to the wizard as a **server-rendered prop**, no API | `lib/areas.ts`, `app/compare/page.tsx` |
| OCR | Server: Claude vision (`/api/extract`). Client fallback: tesseract.js WASM + pure-TS rules parser | `lib/extraction/*`, `lib/ocr/*` |
| Analytics | Own funnel table + visit presence + IP/UA audit; visit id per Dubai day in localStorage; UTM/fbclid first-touch capture; Meta Pixel | `lib/analytics/*`, `app/api/events/route.ts` |
| Notifications | Web Push (VAPID) for customers and admins, Telegram for admins, cron chaser | `lib/push/*`, `lib/notifications/*` |
| Rate limiting | In-memory `Map` per Worker isolate, keyed on first `X-Forwarded-For` value | `lib/utils/rate-limit.ts` |
| Storage | Private bucket, paths `submissions/{id}/cart.{ext}`, magic-byte validated | `lib/validation/image.ts`, `0003_storage.sql` |
| Deploy | Cloudflare Workers Builds; CI runs lint, typecheck, vitest, build | `.github/workflows/ci.yml` |

---

## 2. Mobile readiness: 5 / 10

**Strengths**

- There is a real HTTP API for the whole customer journey. Everything a
  customer does already goes through JSON/multipart route handlers, not server
  actions: `/api/extract`, `/api/submissions`, `/api/result/[token]`,
  `/api/result/lookup`, `/api/events`, `/api/push/subscribe`, `/go/[token]`.
  A Flutter app can drive the core flow with no backend change at all.
- Business logic is on the server and already has one source of truth: the
  saving maths, the result projection (`getPublicResult`), image validation,
  Zod validation, Keeta allow-listing, attribution inheritance.
- Security posture is good: RLS denies anon entirely, the service-role key is
  `server-only`, tokens are 128/256-bit, result projection strips internal
  fields, the redirect is not an open redirect.
- Auth is Supabase, which has first-class Flutter support (`supabase_flutter`),
  so a shared customer identity across web/Android/iOS is straightforward to add.
- No cookies are needed for the customer flow (drafts aside), so a native client
  is not fighting a browser-session design.

**Blockers**

1. **No customer accounts at all.** Points, rewards and order history (the
   things that justify an app) have no data model, no auth and no endpoints.
2. **Rate limiting is unsuitable for mobile traffic.** It is per-isolate memory
   (not durable), and it keys on the first `X-Forwarded-For` value, which the
   client controls. Mobile carriers put many users behind one CGNAT IP, so a
   durable IP limit of 5 submissions / 10 min would also block real users.
3. **Web-only pieces baked into the API contract:** areas and the upload
   promotion only arrive as server-rendered props; push subscriptions accept
   only Web Push endpoints (no FCM/APNs device tokens); `resultPath` is returned
   instead of a token; errors are English sentences with no machine code.
4. **No API versioning or minimum-version control.** Store apps cannot be
   force-updated, so today's "change the route and deploy" workflow would break
   installed apps.
5. **No platform dimension in data.** `submissions`, `funnel_events`,
   `keeta_clicks` cannot tell web from Android from iOS.

---

## 3. What can be reused

| Component | Reuse | Notes |
| --- | --- | --- |
| Next.js backend on Cloudflare | **Unchanged** as the single backend | Add mobile endpoints to it; no second backend |
| Supabase Postgres schema | **Unchanged**, plus additive migrations | Add platform columns, customer tables later |
| Supabase Storage + upload pipeline | **Unchanged** | `createSubmission` already takes multipart and validates by magic bytes |
| `POST /api/submissions` | **As is** (then v1 alias) | Flutter sends the same form fields |
| `POST /api/extract` (Claude vision) | **As is** | Becomes the primary reader for mobile |
| `lib/extraction/parse-text.ts` | **Reusable server-side** | Pure TS, no DOM; can be exposed as a text→basket endpoint so Dart never reimplements it |
| `GET /api/result/[token]` + `getPublicResult` | **As is** | Same projection for web and app |
| `POST /api/result/lookup` | **As is** | "Find my order" works immediately |
| `GET /go/[token]` click tracking | **As is** | App opens it in the external browser / hands off to Keeta |
| `POST /api/events` | **Mostly** | Works today; needs a `platform` field to be useful |
| Saving/money maths, Zod rules | **Server copy is authoritative** | App shows server numbers; does not recompute |
| Admin panel (web + admin PWA push) | **Unchanged** | Do not build admin in Flutter |
| Telegram/admin alerts, cron chaser | **Unchanged** | Fire on any submission, whatever the client |
| Keeta allow-list, attribution inheritance | **Unchanged** | |
| Supabase Auth | **Reused** for customers when accounts arrive | Same `auth.users`, customers never get `admin_profiles` |
| Brand assets (`app/icon.svg`, `public/food`, `public/brands`) | **Reused** as app assets | |

Not reusable in Flutter: React components, tesseract.js OCR, `lib/images/compress.ts`,
`lib/analytics/track.ts`/`attribution.ts` (browser storage/URL based),
`lib/push/client.ts` + `public/sw.js`, `lib/pwa/install.ts`, `AddToHomeScreen`,
Meta Pixel, sessionStorage wizard resume.

---

## 4. What must be built for Flutter

- App shell: theming from the Tailwind tokens in `app/globals.css`, brand
  wordmark, EN (and later AR/RTL) localisation.
- API client layer (typed models for Basket, PublicResult, Area, errors).
- Upload screen: gallery picker + camera, multi-select for cart + checkout,
  client-side downscale/re-encode (replaces `compressForUpload`).
- Basket confirm/edit screen (port of `StepConfirm` + `BasketEditor`): restaurant,
  items, quantities, prices, read totals, "use this total", area picker
  (grouped by city), new-to-Keeta, optional WhatsApp, consent.
- Waiting/result screen with polling + push, "Open on Keeta", copy reference.
- Local order history (list of `{reference, resultToken, createdAt}`) — replaces
  `last-order.ts`; later synced to the account.
- Find-my-order screen.
- Deep-link handling for `/r/<token>` (App Links / Universal Links).
- Native push (FCM for Android, APNs via FCM for iOS) registration.
- Analytics client (visit/install id, events with platform + app version;
  optional Meta App Events SDK for ad attribution).
- "Open food app" links (Talabat/Careem/etc., `lib/customer/food-apps.ts`) with
  app-lifecycle "returned from app" detection.
- Later: login (phone OTP), account screen, points wallet, rewards, account deletion.

---

## 5. Required backend changes

Ordered by when they are needed. All are additive; none change the web flow.

**Before any Flutter code ships to users (Phase 0)**

1. **Versioned mobile API surface.** Add `/api/v1/*` routes that are thin
   wrappers over the existing handlers/libs (same functions, no copy of logic),
   plus `GET /api/v1/config` returning: minimum supported app version, active
   areas (`getPublicAreas()`), current upload promotion
   (`currentUploadPromotion()`), result promise minutes, food-app links, feature
   flags. This removes every "server-rendered prop" dependency.
2. **Return the token, not only a path.** `POST /api/v1/submissions` returns
   `{referenceNumber, resultToken, resultUrl}`.
3. **Error envelope with codes.** `{error: {code, message, field}}`, e.g.
   `rate_limited`, `image_too_large`, `invalid_image`, `area_inactive`. The app
   localises by code; the web keeps using `message`.
4. **Rate limiting fixed and durable.** Key on `cf-connecting-ip` (not the
   client-supplied first XFF hop), store counters in a Durable Object / KV /
   Postgres, and — for mobile — combine IP with an app installation id (and later
   the user id) so CGNAT users are not blocked together. Keep
   `checkRateLimit`'s signature so call sites don't change.
5. **Client/platform columns.** Additive migration: `client_platform`
   (`web|android|ios`) and `app_version` on `submissions`, `funnel_events`,
   `keeta_clicks`, `visitor_ips`. Set from a `X-SnipSavor-Client` header.
6. **App-origin protection for public endpoints.** Firebase App Check (Play
   Integrity / App Attest) or at minimum a signed client header on v1 routes, so
   `/api/extract` (paid Claude calls) is not trivially scriptable.

**For deep links and push (Phases 3–5)**

7. **`/.well-known/assetlinks.json` and `/.well-known/apple-app-site-association`**
   served from `public/.well-known/` (with correct `Content-Type`), covering
   `/r/*` only. WhatsApp result links then open the app when installed and the
   web page otherwise — no link format change.
8. **Native push.** New table `device_push_tokens` (platform, FCM token,
   installation id, optional `submission_id`, later `user_id`) rather than
   bending `push_subscriptions`, whose constraints are Web Push-specific.
   `POST /api/v1/push/register` authorised by result token (now) or user JWT
   (later). Extend `pushToCustomer` (`lib/push/send.ts`) to also send via the FCM
   HTTP v1 API (service-account JWT signed with Web Crypto, which works on
   Workers — same approach as the existing VAPID code).
9. **Text→basket endpoint** (`POST /api/v1/extract/text`) that runs
   `parseOcrText` on the server, so an on-device ML Kit fallback reuses the
   existing parser instead of a Dart port.

**For accounts, history and points (Phases 6–7)**

10. **Customer identity:** Supabase Auth phone OTP (the WhatsApp number is
    already the customer's identity), `customer_profiles` table, nullable
    `submissions.customer_id`, endpoint to claim past submissions by result
    token, `GET /api/v1/me/orders`, `DELETE /api/v1/me` (App Store requires
    in-app account deletion).
11. **One auth helper for both clients:** `getCustomer(request)` that accepts a
    Supabase cookie session (web) *or* `Authorization: Bearer <jwt>` (app), and
    verifies with `supabase.auth.getUser(jwt)`.
12. **Points ledger (server only):** append-only `points_ledger` with idempotency
    keys, balances derived server-side, awards only on server-verified events
    (e.g. a submission answered, a Keeta conversion once `keeta_clicks`
    conversion data is real). No client-side point logic, ever.
13. Screenshot retention job (README says not implemented) — needed for the
    App Store privacy label / Play data-safety answers you will have to give.

---

## 6. Authentication review

**Today**

| Client | Customer | Admin |
| --- | --- | --- |
| Web | Anonymous. Access to a result = holding the 128-bit token. | Supabase email/password → cookie session → `requireAdmin()` + RLS |
| Android / iOS | Works identically: no login is required for the customer flow. Token-in-URL model is platform-neutral. | Admin server actions are cookie/RSC-bound and not callable from Flutter. Not needed: keep admin on the web. |

So "same user account across web, Android and iOS" is not yet a question —
there are no customer accounts. The existing admin login is web-only by design
and should stay that way.

**Proposed architecture for customer accounts**

- **One identity provider: the existing Supabase Auth project.** Customers and
  admins both live in `auth.users`; admin rights continue to come only from
  `admin_profiles` (RLS `is_admin()`), which a customer can never write. I
  checked `0002_row_level_security.sql`: every `authenticated` policy is gated on
  `is_admin()` except `admin_profiles_select_self`, so enabling customer sign-up
  does not open admin data. Re-verify later migrations when implementing.
- **Login method: phone OTP** (SMS or WhatsApp via a Supabase SMS provider such as
  Twilio/MessageBird). It matches the identity already collected, avoids
  passwords, and avoids Apple's "Sign in with Apple is required if you offer
  third-party social login" rule. Add Apple/Google sign-in only if wanted later,
  and then add both.
- **Web:** `@supabase/ssr` cookies (as admins use today).
  **Android/iOS:** `supabase_flutter` handles OTP and refresh; the access token
  is stored in Keychain/Keystore (`flutter_secure_storage` as the auth storage),
  and every call to the Next API sends `Authorization: Bearer <access_token>`.
- **The app never reads business tables directly through Supabase.** The anon
  key in the app is used for Auth only; all data goes through the Next API so
  there is one implementation of every rule and RLS can stay closed to non-admins.
- **Anonymous → account upgrade:** the app keeps its local list of result tokens;
  after login it calls `POST /api/v1/me/claim` with those tokens so earlier
  orders join the account. Web can do the same with its last order.
- **Admin separation:** configure `proxy.ts`/`requireAdmin()` behaviour so a
  signed-in *customer* hitting `/admin` is simply refused (today `proxy.ts`
  redirects any signed-in user away from `/admin/login` to `/admin`, where
  `requireAdmin()` then bounces them back — a loop to fix when customers can
  sign in on the web).

---

## 7. Flutter architecture recommendation

Keep it small; this is a 6–8 screen app.

```
snipsavor_app/                 (new repo or /mobile in this repo — see risks)
  lib/
    main.dart, app.dart        MaterialApp.router, theme, l10n
    config/env.dart            API base URL per flavor (--dart-define)
    core/
      api/api_client.dart      dio + interceptors (client header, auth, retry)
      api/api_error.dart       maps {error:{code}} → typed errors
      storage/                 secure storage (tokens), prefs (orders, visit id)
      analytics/events.dart    POST /api/v1/events
      push/push_service.dart   firebase_messaging registration
      links/deep_links.dart    app_links → router
    features/
      compare/  (upload, confirm, submit)   data/ domain/ ui/
      result/   (poll, push, open Keeta)
      orders/   (local history, find order)
      account/  (later: login, profile, points)
  test/
```

| Concern | Choice | Why |
| --- | --- | --- |
| State management | **Riverpod** (plain providers + `AsyncNotifier`) | Enough for a wizard + polling; testable; no BLoC boilerplate |
| Networking | **dio** + `json_serializable`/`freezed` models | Multipart uploads with progress, interceptors, cancel tokens |
| API contract | Generate from an OpenAPI doc produced from the server Zod schemas (e.g. `zod-to-openapi`) | Keeps Dart models and server rules from drifting |
| Auth storage | `supabase_flutter` with `flutter_secure_storage` as its storage | Tokens in Keychain/Keystore; SDK handles refresh |
| Navigation | **go_router** | Declarative, handles `/r/:token` deep links cleanly |
| Deep links | `app_links` + App Links / Universal Links on the real domain | WhatsApp link opens app or web transparently |
| Image picking | `image_picker` (gallery + camera) | Screenshots come from the gallery almost always |
| Compression | `flutter_image_compress` → JPEG ~1600px long edge | Mirrors the web's compress-before-upload; server re-validates |
| OCR | Server `/api/extract` primary; optional `google_mlkit_text_recognition` → `/api/v1/extract/text` fallback | No Dart parser to maintain |
| Push | `firebase_messaging` (FCM on both; APNs key uploaded to Firebase) | One server integration for both platforms |
| External links | `url_launcher` with `LaunchMode.externalApplication` | Keeta/Talabat https links open their apps |
| Environments | Flavors `dev`/`staging`/`prod` + `--dart-define-from-file` | Base URL, Supabase URL/anon key, Firebase config per env |
| Crash/errors | Firebase Crashlytics or Sentry | No server logs exist for client crashes |

Android: `minSdk 23+`, App Links `autoVerify`, Android 13 notification
permission, photo picker (no broad storage permission), Play data-safety form.
iOS: Associated Domains entitlement, APNs key, `NSPhotoLibraryUsageDescription`
/ `NSCameraUsageDescription`, privacy manifest, App Store privacy label
(screenshots can contain name/address; they are sent to Anthropic — disclose),
and Guideline 4.2 (a native app with push, history and camera is safe; a
WebView wrapper is at real risk of rejection).

---

## 8. Android + iOS strategy

**Recommendation: B — one Flutter codebase for both from day one, test and
release Android first.**

- Nothing in the flow is platform-specific except deep links, push and store
  compliance; writing Android-only first saves almost nothing.
- Set up the iOS pieces (bundle id, Associated Domains, APNs key, Firebase iOS
  app) in Phase 1 so they are not a surprise later; run the iOS simulator in CI
  or at least weekly.
- Release Android first (internal testing → closed test → production): faster
  review, easy sideload for the team, and UAE ad traffic can be tested there.
- Submit iOS once Android has been stable for 1–2 weeks. Apple review is the
  longer, less predictable step, so start TestFlight early.

---

## 9. Screen / feature migration map

| Existing web feature | Flutter version | Reuse backend? | Difficulty | Notes |
| --- | --- | --- | --- | --- |
| Landing `/` (currently redirected to `/compare` by `next.config.ts`) | Short onboarding / home with "Check my order" + recent orders | Yes (`/api/v1/config`) | Low | Landing is ad-driven; app home is order-history driven |
| Upload step (`StepUpload`, cart + optional checkout, examples, promo slot) | Upload screen with gallery/camera, two slots, promo banner from config | Yes (`/api/extract`) | Medium | Promotion currently a server prop → config endpoint |
| Screenshot reading (Claude + tesseract fallback) | Server read; optional ML Kit + server parser fallback | Yes | Medium | Do not port `parse-text.ts` to Dart |
| Confirm step (`StepConfirm`, `BasketEditor`, totals, "use this") | Native form: items list editor, totals card, area picker | Yes (validation server-side) | Medium–High | Largest UI port; keep server Zod as authority |
| Area picker (`AreaCombobox`, grouped by city) | Searchable grouped list / bottom sheet | Needs `areas` in config | Low | |
| WhatsApp number + consent (optional) | Phone field with dial code; prefilled from account later | Yes | Low | |
| Submit (`/api/submissions`) | Multipart upload with progress + retry | Yes | Low | Return token (backend change 2) |
| Wizard resume (`/api/drafts`, sessionStorage) | Local state persisted on device | Not needed | Low | Native apps don't lose state on tab discard; drafts API unused by app |
| Result/waiting page `/r/[token]` (`ResultView` polling) | Result screen: poll with backoff + push | Yes (`/api/result/:token`) | Medium | Same projection as web |
| Customer Web Push + `AddToHomeScreen` | FCM push | New endpoint + table | Medium | Biggest mobile advantage over web on iOS |
| "Open on Keeta" (`/go/:token`) | Open `/go/:token?v=` externally | Yes | Low | Keeps click attribution intact |
| Food app links (`FoodAppLinks`, `LandingFoodApps`) | Buttons via `url_launcher`; resume detection via lifecycle | No backend | Low | |
| Last order banner (`LastOrderBanner`, localStorage) | Local order history list | Yes (results by token) | Low | Becomes server history with accounts |
| Find order `/find` | Find order screen | Yes (`/api/result/lookup`) | Low | |
| Copy reference, share result | Clipboard + share sheet | No | Low | Share `/r/` link, never the token alone |
| Funnel analytics / heartbeat / Meta Pixel | App events (+ optional Meta App Events) | Yes, plus `platform` field | Medium | Skip heartbeats or send only while in foreground |
| Privacy page | In-app link to `/privacy` | Yes | Low | Needs update for app data flows |
| Admin dashboard, comparison, analytics | **Stay on web** (admin PWA) | — | — | Not in scope |
| Customer login, account, delete account | New | New endpoints | Medium | Phase 6 |
| Points / rewards / order history (server) | New | New tables + endpoints | High | Phase 7; needs verified conversion data first |

---

## 10. Development phases

**Phase 0 — Backend mobile readiness (1–2 weeks)**
`/api/v1` wrappers, `/api/v1/config`, token in submission response, error codes,
durable rate limiting keyed correctly, `client_platform`/`app_version` columns,
an OpenAPI spec generated from the existing Zod schemas. Web keeps working
unchanged.

**Phase 1 — Flutter foundation (1 week)**
Repo, flavors, theme/brand, go_router, dio client, error mapping, Crashlytics,
CI (analyze + test + build APK/IPA). Firebase projects for both platforms.

**Phase 2 — Core compare flow (2–3 weeks)**
Upload → server read → confirm/edit → area → submit → reference. Local order
list. Analytics events with platform.

**Phase 3 — Result, deep links, Keeta handoff (1–2 weeks)**
Result screen with polling, `/go/` handoff, find-order, App Links / Universal
Links for `/r/*` (+ `.well-known` files on the backend).

**Phase 4 — Native push (1 week)**
`device_push_tokens`, register endpoint, FCM sender alongside Web Push, result-
ready notification opening the result screen.

**Phase 5 — Android QA and Play release (1–2 weeks)**
Real devices (low-end Android, Samsung), slow network uploads, Play internal →
closed → production. Data-safety form.

**Phase 6 — iOS QA and App Store release (1–2 weeks, overlaps Phase 5)**
TestFlight, APNs, Universal Links, privacy manifest/labels, review.

**Phase 7 — Customer accounts (2–3 weeks)**
Phone OTP on web + app, `customer_profiles`, `customer_id` on submissions,
claim-by-token, server order history, account deletion, `getCustomer()` helper.

**Phase 8 — Points & loyalty (3+ weeks, after business rules are defined)**
Ledger, idempotent awards on server-verified events, wallet UI, anti-abuse.
Depends on Keeta conversion data (today `conversion_status` is always
`unknown`).

Accounts come after the first release deliberately: the anonymous flow is what
the web validates today, and it works on mobile with Phase 0 alone.

---

## 11. Risks

1. **Duplicated business logic.** The biggest long-term risk. Mitigation: the app
   never computes savings, validates money rules or parses OCR text itself; it
   displays what the server returns. Generate Dart models from an OpenAPI spec
   built from the server Zod schemas.
2. **Server Actions are invisible to the app.** Anything added as a Server
   Action (the current habit for admin features) cannot be called from Flutter.
   Rule: every customer-facing capability is a route handler under `/api/v1`.
3. **Unversioned API + un-updatable installs.** A routine change to
   `/api/submissions` fields could break every installed app. Version the mobile
   surface and add a min-version gate in `/api/v1/config`.
4. **Rate limiting / abuse.** In-memory, spoofable key, and CGNAT collisions.
   `/api/extract` spends real money per call; an app makes it easier to script.
5. **Analytics split.** The funnel (`lib/analytics/funnel.ts`) is built around
   web visits (Dubai-day visit id, UTM capture, landing view). App traffic will
   either be invisible or distort web funnels unless tagged by platform.
   Attribution for app installs needs a different mechanism (Meta App Events /
   install referrer).
6. **Feature flags and temporary web experiments** (`BYPASS_INTRO` in
   `next.config.ts`, `DRAFT_RESUME`, `lib/customer/promotion.ts`) are coded into
   the web layer. Anything that should change both clients must come from the
   config endpoint.
7. **Push divergence.** Two push systems (Web Push + FCM) sending the same
   event. Keep one `notifyCustomer(submissionId, message)` function that fans
   out to both.
8. **Privacy/documentation drift.** README still says the customer read "sends
   the screenshot nowhere" and lists OCR/push as not built, while
   `/api/extract` sends the image to Anthropic and push exists. Store privacy
   declarations must match reality.
9. **Worker constraints.** 10s CPU limit (`wrangler.jsonc`) and bundle size are
   already tight (OCR assets); FCM signing and new endpoints must stay Web
   Crypto-only, no Node-only libraries (same reason `web-push` was avoided).
10. **Customer sign-up in the admin's auth project.** Safe with the current RLS,
    but every future policy must keep using `is_admin()`; a single
    `to authenticated using (true)` policy would expose data to every customer.
11. **Result token in shared links.** Fine today (by design), but once accounts
    exist, decide whether account-owned results still open by token alone.

**Technical debt to fix before mobile work starts:** durable/correct rate
limiting; config endpoint for areas/promotion; error codes; platform columns;
screenshot retention job; README/privacy accuracy; CI `push` trigger still
points at an old branch (`claude/findfoodae-mvp-build-rc77aj`), so main is only
checked on PRs.

---

## 12. Recommended first implementation task

**Create the versioned mobile API foundation without changing web behaviour:**

1. `GET /api/v1/config` — min app version, active areas (`getPublicAreas()`),
   current promotion, result-promise minutes, food-app links, feature flags.
2. `POST /api/v1/submissions` — calls the existing `createSubmission()`
   unchanged, returns `{referenceNumber, resultToken, resultUrl}` and the new
   error envelope `{error: {code, message, field}}`.
3. `GET /api/v1/results/:token` — delegates to `getPublicResult()`.
4. Read an `X-SnipSavor-Client: android/1.0.0` header and store
   `client_platform`/`app_version` (one additive migration).
5. Vitest coverage for each route using the existing fake-Supabase pattern in
   `tests/`.

It is small, additive, testable with the current suite, unblocks Phase 1–2 of
the app, and forces the API-contract decisions (versioning, error codes,
platform tagging) that everything else depends on. Durable rate limiting is the
immediate follow-up task.

---

## Summary

- **Mobile approach:** Native Flutter app (not a WebView) for customers only; admin stays on the web.
- **Backend reuse:** Very high. Same Next.js/Cloudflare backend, Supabase DB, storage, comparison logic and admin panel; add a versioned `/api/v1` surface, no second backend.
- **Flutter suitability:** Good. The customer flow is already API-driven and Supabase Auth has first-class Flutter support.
- **Build Android + iOS together?:** Yes, one codebase from day one; test and release Android first.
- **Major blocker:** No customer accounts / points model, plus an unversioned, web-shaped API with weak rate limiting.
- **First thing to fix/build:** `/api/v1` foundation (config, submissions, results, error codes, platform tagging), then durable rate limiting.
- **Overall difficulty:** 6/10 (4/10 for the anonymous flow; accounts + points push it up).
