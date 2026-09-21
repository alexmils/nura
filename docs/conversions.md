# Server-side conversion tracking

How a purchase on `nurahelp.com` reaches GA4, Meta, and Google Ads.

## Why this exists

The funnel is **7-day trial, card collected by Stripe Checkout**. That means:

- nothing is charged when the customer checks out — the browser leaves for
  `checkout.stripe.com` and comes back to `/app/onboarding?checkout=success`;
- the first real charge happens **seven days later on Stripe's servers**, with
  no browser anywhere near it;
- the browser tags only ever see the trial start, never the money.

Before this, GA4 received no custom events at all (only its own automatic
`page_view` / `scroll` / `session_start`), so `purchase` sat in GA4 Key events
with "No stream data detected" and Google Ads had nothing to import. Meta looked
healthy because the GTM container ships the pixel base — but what it counted was
also the trial start, not the charge.

## What the browser reports, and what only the server can

| Event | Where it fires | GA4 name |
| --- | --- | --- |
| Account created | `/app/create-account` | `sign_up` |
| Checkout started | onboarding / billing | `begin_checkout` |
| Trial started | onboarding after Stripe redirect | `start_trial` |
| Subscription activated | onboarding / billing after redirect | `start_subscription` |
| **First real charge** | **Stripe webhook `invoice.paid`** | **`purchase`** |

The client deliberately never sends GA4 `purchase`. Only the webhook knows the
invoice id, and that id is what stops a charge being counted twice — so the
browser reports `start_subscription` and the server reports `purchase`, once,
with the real amount.

`start_subscription` is also the better Google Ads optimization target: it
happens in a live session with the click still attached, while `purchase` is
seven days and one session away.

## How the charge is attributed back to the click

1. `MarketingTags` (marketing pages + `create-account` / `onboarding` /
   `billing`) writes the first-touch click into the `nura_attr` cookie:
   `gclid` / `gbraid` / `wbraid`, `fbclid` / `_fbc`, `_fbp`, the GA4 `_ga`
   client_id, landing page, UTMs, and the explicit cookie decision.
2. `POST /api/auth/register` and `POST /api/billing/checkout` persist that
   snapshot to `user_attribution`. This is the last moment the click is visible.
3. Seven days later the `invoice.paid` webhook reads it back and reports the
   charge to each configured channel. `conversion_dispatches` guarantees
   `(channel, transaction_id)` is delivered at most once, so a webhook retry
   cannot double-count a charge.

Click ids are first-touch for 90 days; `_ga` client_id, `_fbp`, and the consent
decision refresh on every capture.

## Channels

Each channel is skipped — never fatal — when its credentials are missing or the
visitor's click carries nothing it can use. A failure inside a channel is
logged, recorded on the dispatch row, and the webhook still returns 200.

| Channel | Needs | Credited by |
| --- | --- | --- |
| GA4 Measurement Protocol | GA4 API secret | stored `client_id` |
| Meta Conversions API | dataset access token | `_fbp` / `_fbc` + hashed email |
| Google Ads offline conversions | developer token + OAuth refresh token | `gclid` / `gbraid` / `wbraid` |

### GA4 Measurement Protocol

1. GA4 → **Admin → Data streams** → your web stream →
   **Measurement Protocol API secrets** → **Create** → copy the secret value.
2. Set `GA4_API_SECRET`. The measurement id is reused from
   **Admin → SEO → Connections**, so there is nothing else to paste
   (`GA4_MEASUREMENT_ID` only overrides it for preview environments).
3. Optional: `GA4_MP_DEBUG=1` switches the send to Google's
   `/debug/mp/collect`, which validates the payload and returns why it would be
   rejected. Note what it does **not** do: the debug endpoint answers 200 even
   for a wrong or revoked `api_secret`, so it can only ever confirm the payload
   shape. A wrong secret shows up only against the real endpoint — as a 403 —
   so leave debug off when the question is "is my secret right?".

Caveat worth knowing: the Measurement Protocol event is stitched back to the
visit by `client_id`. A charge seven days later is a new session, so Google Ads
attribution through GA4 is approximate. The Google Ads channel below is the
precise one.

### Meta Conversions API

1. Events Manager → **Data sources** → the Nura dataset → **Settings** →
   **Conversions API** → **Generate access token** → `META_CAPI_ACCESS_TOKEN`.
2. `META_PIXEL_ID=1120650977294654`.
3. Optional `META_TEST_EVENT_CODE` (Test Events tab) to route probes there.
4. Email and user id are SHA-256 hashed before sending. Deduplication with the
   browser pixel uses `event_id` = the Stripe invoice id.

### Google Ads offline conversions

This is the only channel that credits the exact click, and it is the one that
needs the most setup.

1. Google Ads → **Tools → API Center** → apply for a **developer token** →
   `GOOGLE_ADS_DEVELOPER_TOKEN` (basic access).
2. Google Cloud Console → create an **OAuth client** →
   `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`, then mint a refresh
   token for the `https://www.googleapis.com/auth/adwords` scope (the OAuth
   Playground is the quickest route) → `GOOGLE_OAUTH_REFRESH_TOKEN`.
3. Google Ads → **Goals → Conversions** → create a conversion action for
   imported click conversions, then take the trailing number from
   `customers/X/conversionActions/Y` → `GOOGLE_ADS_CONVERSION_ACTION_ID`.
4. `GOOGLE_ADS_CUSTOMER_ID` = the serving account, digits only
   (`3522581611327832`, dashes are stripped automatically).
5. Only when the conversion action lives under a manager account:
   `GOOGLE_ADS_LOGIN_CUSTOMER_ID`.
6. If the default API version (`v21`) is ever deprecated, set
   `GOOGLE_ADS_API_VERSION`.

Service accounts are rejected by the Ads API unless they use domain-wide
delegation, which is why this uses a refresh token from a real user.

## Consent

The cookie banner decision is stored in the attribution cookie and persisted
with the click, so the webhook knows it days later. An explicit rejection
silences the matching platforms — GA4 follows the **analytics** choice, Meta and
Google Ads follow the **marketing** choice. A visitor who never chose is treated
the same way the client tags already treat them: tags load, Consent Mode signals
stay denied, events still send.

Known gap: a mid-trial opt-out reaches the stored snapshot at the next visit,
not instantly. A charge that lands before the customer browses again is still
reported.

## Verifying a setup

While signed in as a platform admin:

```
GET  /api/admin/conversions              # which channels parsed + recent log
POST /api/admin/conversions              # {"channel":"ga4"|"meta"|"google_ads"}
```

The probe sends a `purchase` with value 0 and a `test_…` transaction id. For
Google Ads it runs with `validateOnly`, so Google validates the payload without
recording a conversion.

Probes supply their own throwaway GA4 `client_id` and click id, because the
account running them has no captured click — without that, every channel would
answer `skipped: no GA4 client_id captured`. Reading their answers:

- `ga4: skipped (no GA4 client_id captured)` — should no longer happen; if it
  does, the probe could not build an identifier.
- `ga4: failed (403 …)` — the api secret is wrong or revoked. This is the only
  place that mistake becomes visible.
- `google_ads: failed (… invalid click id …)` — **success in disguise**: the
  probe's click id is fake by design, so a rejection at that point means the
  developer token, OAuth token, and conversion action all resolved. An auth or
  permission error is the real failure to act on.

Where to confirm each one:

- **GA4** → Reports → Realtime (or `GA4_MP_DEBUG=1` for the validation answer),
  and Admin → Events: `purchase` should stop saying "No stream data detected".
- **Meta** → Events Manager → the dataset → Test Events (with a test code) or
  the event log.
- **Google Ads** → Goals → Conversions: the imported action starts counting.

## Google Ads import still needs one manual step

The GA4 link exists (Admin → Product links → Google Ads links), so once
`purchase` carries data it can be imported:

1. Google Ads → **Goals → Conversions → Import → Google Analytics (GA4)**.
2. Select `purchase`, assign the **Purchase** category.
3. Confirm the accounts running Nura campaigns are among the linked ones.

## Files

- `lib/attribution.ts` — capture and parsing (client-safe).
- `lib/attribution-server.ts` — persistence.
- `lib/conversions/` — `config` (credentials), `payloads` (wire formats),
  `ga4` / `meta` / `google-ads` (transports), `dispatch` (orchestration).
- `lib/meta-pixel.ts` — browser Meta event + its GA4 twin.
- `app/api/webhooks/stripe/route.ts` — where the charge is reported.
