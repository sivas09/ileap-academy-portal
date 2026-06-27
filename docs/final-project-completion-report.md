# iLEAP Academy Portal Final Project Completion Report

## 1. Executive Summary

The iLEAP Academy English Writing Program portal is implemented as a production-ready full-stack web application for public program marketing, student access, teacher/admin content management, AI writing feedback, resource delivery, and one-time Stripe purchases.

The current production target is:

```text
https://english.ileapacademy.com
```

The portal is designed to run on Render as one Node.js web service backed by PostgreSQL. The app uses the `english_portal` PostgreSQL schema so it can coexist safely inside a future shared iLEAP database with other applications such as iLEAP Club and iLEAP Tech AI.

## 2. Requirements Coverage

### Public Website

- Public English Writing Program experience is included.
- Program levels are represented for Grade 2/3, Grade 4/5/6, and Grade 7/8/9.
- Public visitors can enter the portal, browse program/resource/product information, and reach login or purchase flows.
- Branding follows the iLEAP Academy color direction and student-focused tone documented in the requirements.

### Authentication And Roles

- Email/password authentication is implemented.
- JWT-based sessions are used for authenticated API access.
- Student, teacher, and admin roles are supported.
- Expired or invalid tokens are cleared on the frontend and users are redirected to login with the message: `Your session expired. Please log in again.`
- Backend protected routes return `401` for missing, invalid, expired, or inactive-user tokens.

### Student Portal

- Students can log in to a dashboard.
- Students can view level-specific resources and assignments.
- Students can access purchased or unlocked resources.
- Students can use AI Tutor workflows where enabled by the portal.

### Teacher Portal

- Teachers can manage educational content where authorized.
- Teacher access is scoped so teachers do not receive full admin privileges.
- Teacher resource download access is restricted to assigned levels.

### Admin Portal

- Admin users can manage users, resources, assignments, AI prompts, products, orders, and website-related content.
- Admins can adjust student access and review portal activity.
- Admin pages remain behind authenticated role checks.

### AI Tutor

- OpenAI integration is available for AI writing feedback.
- Prompt management is supported so future prompt updates do not require code changes.
- AI service failures are handled with user-facing error messages.
- Student writing and AI feedback are stored for later review where authorized.

### Shop And Payments

- Stripe checkout integration is included for one-time purchases.
- Stripe webhook handling is included for checkout completion.
- The app records orders, order items, products, and resource entitlements.
- Card data is handled by Stripe and is not stored in the portal.

### Deployment

- Render deployment is documented.
- Render build and start scripts are present.
- Prisma migrations deploy on startup through the Render start command.
- Production database access is scoped to the `english_portal` schema.

## 3. Technology Stack

### Frontend

- React 19
- TypeScript
- Vite
- CSS modules/global stylesheet approach in the existing app structure
- `lucide-react` for interface icons

### Backend

- Node.js
- Express 5
- TypeScript
- Prisma ORM
- PostgreSQL
- JWT authentication
- `bcryptjs` password hashing
- `zod` validation
- `helmet` security headers
- `cors` request origin control
- `multer` upload handling

### External Services

- Render web service for application hosting
- Render PostgreSQL for production database hosting
- Render persistent disk as current upload fallback
- Cloudflare R2-compatible storage support through AWS S3 SDK
- OpenAI API for AI Tutor feedback
- Stripe for checkout and payment webhooks
- SMTP through `nodemailer` for email delivery

### Tooling

- Prisma migrations
- TypeScript compiler checks
- Vite production build
- npm dependency audit
- GitHub repository workflow

## 4. Production Architecture

### Current Recommended Architecture

```text
Browser
  |
  | HTTPS
  v
english.ileapacademy.com
  |
  v
Render Web Service
  |-- React static app
  |-- Express API
  |-- JWT auth middleware
  |-- Prisma client
  |
  | PostgreSQL connection, schema=english_portal
  v
Render PostgreSQL
```

This is the safest low-cost architecture for the current iLEAP Academy portal because the frontend and backend deploy together, migrations are centralized, and the database schema is isolated from future iLEAP applications.

### Shared iLEAP Architecture Direction

For multiple iLEAP applications under one Render account, the recommended direction remains:

- Separate Render web service per major app.
- One shared paid Render PostgreSQL instance at first.
- Separate PostgreSQL schema per app:
  - `english_portal`
  - `ileap_club`
  - `ileap_tech_ai`
  - `shared_identity` later if SSO is introduced.
- Separate environment variables per Render service.
- Separate deployment pipelines per application.

This avoids one app deployment breaking another app while keeping database cost low.

## 5. Database Architecture

The current app uses Prisma with PostgreSQL and the `english_portal` schema.

Recommended production database strategy:

- Use a paid Render PostgreSQL instance before storing real student/payment data.
- Keep iLEAP Academy data in `english_portal`.
- Do not place future iLEAP Club or iLEAP Tech AI tables in the same schema.
- Use Prisma migrations for schema changes.
- Run `npm run render:migrate` or the Render start script to apply migrations.
- Use Render database backups, and export periodic off-platform backups for disaster recovery.

This design supports shared infrastructure without mixing application tables.

## 6. Security Architecture

Current security controls:

- Passwords are hashed with `bcryptjs`.
- API access uses JWT verification.
- Expired JWTs return `401`.
- Frontend handles authenticated `401` responses globally and redirects to login.
- Inactive users are rejected by protected backend routes.
- Role checks protect student, teacher, and admin operations.
- Teacher resource access is scoped by assigned level.
- Stripe webhook verification protects payment completion events.
- Helmet is enabled for HTTP security headers.
- CORS is controlled by backend configuration.
- Stripe card data is not stored locally.

Recommended next security improvements:

- Add API rate limiting for login and AI endpoints.
- Move from localStorage JWTs to secure HTTP-only cookies when feasible.
- Add structured audit logging for all sensitive admin actions.
- Add Sentry or another error-monitoring service.
- Confirm privacy, AI usage, and student data retention policies before full launch.

## 7. File Storage Architecture

Current behavior:

- Uploaded files can use Render persistent disk as a fallback.
- Cloudflare R2-compatible storage support is present through the S3 client.

Recommended production behavior:

- Use Cloudflare R2 for uploaded PDFs, worksheets, books, and long-term file storage.
- Keep Render disk only as a temporary or transitional fallback.
- Store only file metadata and access rules in PostgreSQL.
- Use signed URLs or authenticated download endpoints for protected resources.

Cloudflare handles object storage if R2 is configured. Render handles the web app and PostgreSQL database.

## 8. Deployment Strategy

### Render

Production should deploy from GitHub to Render using the existing Render service configuration.

Expected production steps:

1. Push code to GitHub.
2. Render pulls the repository.
3. Render runs the build command.
4. Prisma Client is generated.
5. React and server TypeScript builds are produced.
6. Render start command applies migrations.
7. Express serves the API and frontend.

### Required Production Environment Variables

Core:

- `DATABASE_URL`
- `APP_DATABASE_SCHEMA=english_portal`
- `JWT_SECRET`
- `PORT`

AI:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`

Payments:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Storage:

- `R2_BUCKET`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_ENDPOINT`

Email:

- `SMTP_HOST`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `DEFAULT_SUBMISSION_NOTIFICATION_EMAIL`

## 9. Domain Mapping

Current portal:

```text
english.ileapacademy.com -> Render iLEAP Academy web service
```

Recommended future mapping:

```text
academy.ileap.com or english.ileapacademy.com -> iLEAP Academy portal
memberportal.ileapclub.com                  -> iLEAP Club member portal
tech.ileaptechai.com                        -> iLEAP Tech AI portal
admin.ileap.com                             -> future shared admin/identity portal
```

Each domain should point to the correct Render web service using Render's custom domain instructions and DNS CNAME records.

## 10. Quality Test Results

Quality checks completed during this final pass:

| Check | Command | Result |
|---|---|---|
| Frontend TypeScript and Vite production build | `npm.cmd run build` | Passed |
| Server TypeScript build | `npm.cmd run build:server` | Passed |
| Render-style production build | `npm.cmd run render:build` | Passed |
| Production dependency audit | `npm.cmd audit --omit=dev` | Passed, 0 vulnerabilities |

The Render build was verified with a PostgreSQL-shaped local placeholder connection string:

```text
postgresql://user:pass@localhost:5432/ileap?schema=english_portal
```

This was used only so Prisma could validate the database URL shape during build verification. It did not deploy or modify production data.

## 11. Dependency Quality Updates

The production dependency audit initially reported vulnerabilities in transitive packages and `nodemailer`.

Completed cleanup:

- Updated lockfile dependency resolutions through `npm audit fix`.
- Upgraded `nodemailer` to `^9.0.1`.
- Re-ran build and audit checks after the upgrade.
- Confirmed `npm audit --omit=dev` reports `0 vulnerabilities`.

No application source code changes were required for the `nodemailer` upgrade.

## 12. Known Limitations

The portal is in a strong production-preparation state, but the following items should be addressed as operational hardening:

- No formal automated unit test suite is currently documented as part of the project.
- No full browser end-to-end regression suite is currently documented.
- Live production login was not verified during this quality pass because production credentials were not used.
- Production data retention, privacy, consent, and AI disclosure language still need final business/legal confirmation.
- Long-term file storage should be moved fully to Cloudflare R2 before heavy real usage.
- Monitoring and alerting should be added before scaling usage.

## 13. Recommended Launch Checklist

Before declaring public production launch:

1. Upgrade Render PostgreSQL to a paid plan.
2. Confirm `english.ileapacademy.com/api/health` returns `{ "ok": true }`.
3. Verify admin login using the production admin account.
4. Verify one student login and one teacher login.
5. Verify expired session behavior redirects to login.
6. Upload and download one test resource per level.
7. Submit one test assignment.
8. Generate one AI Tutor response using a test writing sample.
9. Complete one Stripe test checkout and confirm entitlement unlock.
10. Confirm Stripe webhook event delivery.
11. Confirm SMTP email delivery.
12. Confirm R2 upload/download if R2 is enabled.
13. Review privacy, AI, and payment notices.
14. Confirm database backups are enabled.

## 14. Recommended Next Improvements

Priority improvements:

- Add automated tests for authentication, role authorization, resources, assignments, AI Tutor, and Stripe webhook handling.
- Add Playwright end-to-end tests for student, teacher, and admin flows.
- Add rate limiting and login brute-force protection.
- Add structured server logging and error monitoring.
- Add CI through GitHub Actions:
  - `npm ci`
  - `npm run build`
  - `npm run build:server`
  - `npm audit --omit=dev`
- Complete Cloudflare R2 production storage migration.
- Add operational runbooks for admin account repair, backup restore, and Stripe webhook debugging.

## 15. Final Status

The iLEAP Academy English Writing Program portal has the core requirements, technical stack, production architecture, deployment path, security model, and quality verification needed for controlled production use.

The project is ready for production validation on Render, with the strongest remaining work being operational hardening, automated test expansion, monitoring, and final policy review for student data and AI usage.
