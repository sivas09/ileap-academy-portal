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
- Render persistent disk: fallback storage for uploaded PDFs/books/worksheets
- Cloudflare R2: preferred production storage for new uploaded files
- OpenAI API: AI tutor feedback
- Stripe: optional checkout/webhook flow

## Required Render Environment Variables

The `render.yaml` blueprint defines most variables. Add the secret values in Render:

```env
OPENAI_API_KEY=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
R2_BUCKET=...
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
SMTP_HOST=...
SMTP_USER=...
SMTP_PASS=...
```

Render generates `JWT_SECRET` automatically.
Render provides `DATABASE_URL` from the shared PostgreSQL database. The app sets `APP_DATABASE_SCHEMA=english_portal`, and the Render start script appends `?schema=english_portal` before running Prisma migrations and the server.
`R2_ENDPOINT`, `SMTP_FROM`, and `DEFAULT_SUBMISSION_NOTIFICATION_EMAIL` are optional unless your Cloudflare or email setup requires custom values.

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

## Create Or Repair Admin Login

Do not run `npm run db:seed` in production unless you intend to reset seeded portal data. To create or repair one admin account, open the Render web service Shell and run:

```bash
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='Member123!' npm run admin:ensure
```

This command runs through the app database wrapper, so it targets the `english_portal` schema.

## Notes

- Prisma uses PostgreSQL migrations and deploys them with `prisma migrate deploy`.
- This app uses only the `english_portal` PostgreSQL schema inside the shared Render database.
- Uploaded files are stored on the Render persistent disk for now.
- For larger scale later, replace local disk storage with S3, Cloudflare R2, or Supabase Storage.
- The free Render PostgreSQL plan is suitable for testing only. Upgrade before storing real student/payment data.
