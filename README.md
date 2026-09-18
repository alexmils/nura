# Nura

Next.js web app for **EMDR Support** with guided sessions, visual sets, and account memory notes. Brand: **Nura** · Operator: **Receptly LLC** · Site: [nurahelp.com](https://nurahelp.com). See `docs/brand.md`.

## Features

- Left sidebar with session threads and account menu
- Center canvas with AFTL-style ball controls (speed, repeats, sound, animation, vibration, gear)
- Faded agent overlay at bottom-center with hover history and roll-in animation
- Space / gamepad to start/stop BLS
- Settings: Auto voice, DeepSeek/OpenAI/Claude, ElevenLabs, memory notes
- Memory notes are account-wide; edit, delete, or clear all in Settings → Memory

## Setup

```bash
npm install
cp .env.example .env
npm run db:up    # Postgres on localhost:5434 (5432/5433 often already in use)
npm run dev      # http://localhost:3471
```

Add API keys in `.env` or via Settings.

### Ports

| Service   | Port | Notes                          |
|-----------|------|--------------------------------|
| Next.js   | 3471 | dev + production start         |
| Postgres  | 5434 | Docker; maps to 5432 in container |

To use an existing Postgres instance instead of Docker, set `DATABASE_URL` in `.env`.

### Production (Coolify)

Full hosting runbook (server, nginx, DNS, Coolify UUIDs, deploy, pitfalls): **[`docs/production.md`](docs/production.md)**. Cursor agents also get [`.cursor/rules/nura-production.mdc`](.cursor/rules/nura-production.mdc).

- Site: [nurahelp.com](https://nurahelp.com)
- Panel: [server.nurahelp.com](https://server.nurahelp.com)
- VPS SSH: `root@217.76.58.141`
- CI: push to `main` → GitHub Actions builds `ghcr.io/alexmils/nura` → Coolify pulls the image (no Next build on the VPS)
- Manual redeploy: Actions → **Build and Deploy** → Run workflow
- Docker image `WORKDIR` is `/nura` (not `/app`) — avoids Next standalone path collision with the `/app` console route

### Dev tunnel (`dev.nurahelp.com`)

Exposes local **3471** behind Cloudflare Access (email one-time PIN; anyone can request a code). Credentials live in `%USERPROFILE%\.cloudflared\` (not git).

```powershell
# With Next already on :3471
cloudflared tunnel run nurahelp-dev
```

Set in `.env` while using the tunnel: `APP_URL=https://dev.nurahelp.com`, `TRUST_PROXY=true`, and WebAuthn RP/origin for `dev.nurahelp.com` (see `.env.example`).

### Stripe billing (consumer onboarding)

Ordinary users complete `/app/onboarding` after invite password setup:

1. Pick a plan → start 7-day trial
2. Stripe Checkout (card required) with a **7-day trial**
3. Quick start tips, then the app
4. Trial limits: **3 guided sessions** and **10 minutes** total Free/BLS
5. Exhausted limits open an **Upgrade** modal (no extra usage spent)

Configure Stripe in **Admin → Billing** (secret key, webhook secret, Price IDs, display prices). Defaults: weekly **€4.99**, monthly **€14.99**, yearly **€99**.

Webhook URL: `/api/webhooks/stripe` — events: `checkout.session.completed`, `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed`.

Customer Portal is available from `/app/billing` → **Manage billing**.

**Stripe Tax:** do not enable `automatic_tax` until you have an active tax registration in the Stripe Dashboard; otherwise no tax is collected.

Existing users with a password are **grandfathered** (`legacy` access) and skip the paywall.

## Disclaimer

Self-help tool only. Not a replacement for licensed therapy.
