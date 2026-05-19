# Render Deployment Guide

This portal should run as a Node.js web service on Render while the main WordPress site remains on SiteGround.

Production URL target:

```text
https://english.ileapacademy.com
```

## Architecture

- SiteGround: existing WordPress/public website
- Render Web Service: React app + Express API
- Render PostgreSQL: production database
- Render persistent disk: uploaded PDFs/books/worksheets
- OpenAI API: AI tutor feedback
- Stripe: optional checkout/webhook flow

## Required Render Environment Variables

The `render.yaml` blueprint defines most variables. Add the secret values in Render:

```env
OPENAI_API_KEY=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
```

Render generates `JWT_SECRET` automatically.

## Deploy Steps

1. Push this project to GitHub.
2. In Render, choose **New > Blueprint**.
3. Connect the GitHub repository.
4. Render will read `render.yaml`.
5. Confirm creation of:
   - `ileap-english-portal`
   - `ileap-english-portal-db`
   - persistent disk mounted at `/opt/render/project/src/uploads`
   - PostgreSQL plan `free` for trial deployment
6. The build command uses `npm ci --include=dev` because TypeScript, Vite, and `@types/*` packages are required during the Render build.
6. Add the secret environment variables.
7. Deploy.

## Custom Domain

1. In Render, open the `ileap-english-portal` web service.
2. Go to **Settings > Custom Domains**.
3. Add:

```text
english.ileapacademy.com
```

4. Render will show a DNS target, usually a CNAME target.
5. In SiteGround DNS, remove the existing record for `english` if it points to the old page.
6. Add the Render DNS record exactly as Render shows it.
7. Wait for DNS propagation.
8. Render will issue HTTPS automatically after DNS verifies.

## Stripe Webhook

If using portal checkout, set the Stripe webhook endpoint to:

```text
https://english.ileapacademy.com/api/stripe/webhook
```

Enable this event:

```text
checkout.session.completed
```

Copy the webhook signing secret into Render:

```env
STRIPE_WEBHOOK_SECRET=whsec_...
```

## First Production Check

After deploy:

```text
https://english.ileapacademy.com/api/health
```

Expected response:

```json
{ "ok": true }
```

Then open:

```text
https://english.ileapacademy.com
```

## Notes

- The Render build converts Prisma from SQLite to PostgreSQL during deployment.
- Local development can continue using SQLite.
- Uploaded files are stored on the Render persistent disk for now.
- For larger scale later, replace local disk storage with S3, Cloudflare R2, or Supabase Storage.
- The free Render PostgreSQL plan is suitable for testing only. Upgrade before storing real student/payment data.
