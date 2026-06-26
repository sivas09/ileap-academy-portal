# iLEAP Enterprise Production Architecture

Last updated: June 26, 2026

## Purpose

Design a shared production architecture that can host multiple iLEAP applications under one Render account while keeping each product operationally isolated.

Referenced repositories:

- `sivas09/ileap-academy-portal`
  - React/Vite frontend
  - Express API
  - Prisma/PostgreSQL
  - English writing portal
  - Authentication, student/teacher/admin roles
  - OpenAI feedback, Stripe, SMTP, Cloudflare R2-ready storage
  - Render deployment already uses `APP_DATABASE_SCHEMA=english_portal`
- `sivas09/ileapclub-website`
  - Static public website
  - Nested `member-portal/` React/Vite + Express app
  - Prisma/PostgreSQL
  - Member portal planning and implementation foundation
  - Admin, facilitator, parent, student roles
  - Centres, clubs, meetings, role slots, attendance, scores, band progress
  - Future agenda generation, meeting workflows, resources, certificates, AI speaking coach

Pricing reference: Render public pricing page, checked June 26, 2026: https://render.com/pricing

## Executive Recommendation

Use a **multi-service, shared-platform architecture**:

- One Render account/workspace for iLEAP production.
- Multiple Render web services, one per private app.
- One shared paid PostgreSQL instance at first.
- Separate PostgreSQL schemas per application.
- Optional shared schemas for identity, audit logs, and platform configuration.
- Static marketing websites on Cloudflare Pages or Render Static Sites.
- Background workers and scheduled jobs added only when workflows need them.
- No API gateway at the beginning.
- Multiple repositories now; consider a platform monorepo later when shared code becomes a real maintenance win.

This gives iLEAP one paid cloud setup while avoiding the main risk of a single combined service: one bad deploy or runtime bug breaking Academy, Club, Tech AI, and future products together.

## Current Repository Observations

### iLEAP Academy Portal

Current production shape:

- Full-stack app in one repository.
- React/Vite client and Express server.
- Prisma migrations against PostgreSQL.
- Render web service defined in `render.yaml`.
- Render startup applies migrations and runs the compiled Express server.
- App already supports schema-scoped deployment through `APP_DATABASE_SCHEMA=english_portal`.
- Uses server-side integrations for OpenAI, Stripe, SMTP, upload handling, and R2-compatible storage.

Architecture implication:

- This repo is already close to the recommended shared-database model.
- It should remain its own Render web service.
- Its schema should remain isolated as `english_portal` unless a planned production migration renames it to `academy_portal`.

### iLEAP Club Website And Member Portal

Current production shape:

- Public marketing website at the repository root.
- Private member portal inside `member-portal/`.
- Member portal is also React/Vite + Express + Prisma/PostgreSQL.
- Existing `render.yaml` uses `rootDir: member-portal`.
- Domain target is `memberportal.ileapclub.com`.
- The data model supports centres, clubs, users, facilitator assignments, parent/student links, meetings, role slots, attendance, scores, and band requirements.

Architecture implication:

- The public website and private member portal should stay separate deployment surfaces.
- The public website can remain static and low cost.
- The member portal should be a separate Render web service.
- Club operations will eventually need background work for email reminders, agenda/certificate generation, scheduled progress jobs, and AI speaking-coach workflows.

## Repository Strategy

### Recommendation

Use **multiple repositories for now**, with a path toward either a shared packages repository or a future monorepo.

Current structure should stay stable:

```text
ileap-academy-portal/
ileapclub-website/
  public website files
  member-portal/
future-ileap-tech-ai/
future-shared-platform/
```

Do not immediately merge the existing repos into a monorepo. The current apps are deployable and understandable as separate products. A forced monorepo migration would add risk before shared code is mature.

### Why Not One Monorepo Immediately

Reasons to wait:

- Academy and Club already have separate repo histories and deployment assumptions.
- Club repo contains both a static website and a private app.
- Prisma versions and React versions currently differ between the apps.
- Shared authentication is not implemented yet.
- A monorepo creates tooling and ownership requirements that should be intentional.

### Target Future Structure

When there are 3+ active private apps and repeated shared code appears, move toward a platform monorepo:

```text
ileap-platform/
  apps/
    academy-portal/
    club-member-portal/
    tech-ai-portal/
    admin-portal/
    auth-service/
  packages/
    ui/
    auth-client/
    database/
    email/
    storage/
    logging/
    config/
  docs/
  infra/
```

Better intermediate step:

```text
ileap-academy-portal/
ileapclub-website/
ileap-tech-ai/
ileap-shared-platform/
  packages/
    ui/
    auth-client/
    email/
    storage/
    config/
```

The intermediate shared-platform repo avoids a disruptive merge while still reducing duplicated code.

## Render Architecture

### Recommended Production Services

Use one web service per private app:

| Service | Type | Domain | Notes |
| --- | --- | --- | --- |
| `ileap-academy-portal` | Render Web Service | `academy.ileapacademy.com` or `english.ileapacademy.com` | Existing Academy/English writing app |
| `ileap-club-member-portal` | Render Web Service | `memberportal.ileapclub.com` | Private Club operations app |
| `ileap-tech-ai-portal` | Render Web Service | `tech.ileaptechai.com` | Future AI product |
| `ileap-admin-portal` | Render Web Service | `admin.ileapapps.com` or `admin.ileap.com` | Add only when cross-app admin is needed |
| `ileap-auth-service` | Render Web Service or managed auth provider | `auth.ileapapps.com` | Add when shared login is required |

Public websites:

| Site | Recommended Host | Notes |
| --- | --- | --- |
| `ileapclub.com` | Cloudflare Pages or Render Static Site | Static public website |
| Main Academy marketing site | Existing host, Cloudflare Pages, or Render Static Site | Keep separate from private portals |
| Tech AI marketing site | Cloudflare Pages or Render Static Site | Keep separate from private app |

### Background Workers

Do not start with background workers unless there is a real asynchronous workload.

Add workers in this order:

1. `ileap-email-worker`
   - invitation emails
   - password reset emails
   - meeting reminders
   - parent notifications
   - payment receipts

2. `ileap-document-worker`
   - agenda RTF generation
   - certificate generation
   - report exports
   - large PDF or document jobs

3. `ileap-ai-worker`
   - essay feedback jobs
   - AI speaking-coach analysis
   - long-running rubric evaluation
   - retry and cost-control logic

For MVP, Academy can continue synchronous AI calls if latency and volume are low. Move AI to a worker when users are waiting on long responses, costs need strict throttling, or retries become important.

### Scheduled Jobs

Use Render Cron Jobs for periodic tasks:

- nightly database health checks
- weekly backup verification reminders
- meeting reminder scheduling
- stale invitation cleanup
- expired password reset cleanup
- monthly usage/cost reports
- student progress recalculation if not done transactionally
- AI usage summary reports

Start with one small cron service and add jobs cautiously.

### API Gateway

Do **not** add an API gateway now.

Use direct app domains:

```text
https://english.ileapacademy.com/api/...
https://memberportal.ileapclub.com/api/...
https://tech.ileaptechai.com/api/...
```

Add an API gateway later only if iLEAP needs:

- one public API domain for external integrations
- centralized rate limiting across apps
- cross-app request routing
- API keys for partners
- mobile app backend aggregation
- centralized WAF/API analytics beyond Render and Cloudflare basics

Until then, a gateway adds cost and operational complexity without solving the current problem.

## Database Architecture

### Recommendation

Use **one paid Render PostgreSQL instance with multiple schemas** for the next phase.

```text
Database: ileap-production

Schemas:
  auth_shared
  audit_shared
  academy_portal
  english_portal
  club_portal
  tech_ai_portal
  admin_portal
  platform_config
```

Use `english_portal` for the current Academy English writing app unless there is a planned rename. Do not rename a production schema casually.

### Schema Ownership

Each app owns only its schema:

| App | Schema |
| --- | --- |
| Academy English writing portal | `english_portal` |
| Broader Academy app, if separate later | `academy_portal` |
| Club member portal | `club_portal` |
| Tech AI portal | `tech_ai_portal` |
| Shared identity | `auth_shared` |
| Shared audit events | `audit_shared` |
| Cross-app settings | `platform_config` |

Rules:

- App migrations must affect only that app's schema.
- Shared schemas require stricter review.
- Each service should set `APP_DATABASE_SCHEMA`.
- Prefer one database role per service when feasible.
- Do not let Club migrations modify Academy tables.
- Do not let Tech AI migrations modify Club operational tables.

### Migration Strategy

For each app:

1. Keep migrations in the app repository.
2. Run `prisma migrate deploy` during deployment or a Render pre-deploy step.
3. Scope `DATABASE_URL` to the app schema.
4. Review destructive migrations before production.
5. Back up before large schema changes.
6. Test migrations against a staging database.
7. Never run demo seed data in production.

For shared schemas:

- Create a dedicated `platform-db-migrations` package or repo.
- Require manual approval before production migration.
- Version shared identity tables carefully.
- Maintain backward compatibility during auth transitions.

### When To Split Into Separate Databases

Stay with one database until one of these happens:

- Postgres CPU, memory, storage, or connections become a bottleneck.
- Tech AI workloads create heavy write/read pressure.
- One app needs independent point-in-time restore.
- A product has different compliance or privacy requirements.
- A product has a different team and release process.
- A high-risk app should not share blast radius with student data.

Long-term split target:

```text
ileap-auth-db
ileap-academy-db
ileap-club-db
ileap-tech-ai-db
ileap-analytics-db
```

## Authentication Architecture

### Should Users Have One Login?

Yes, the long-term user experience should support **one iLEAP login** across applications, but it should be introduced in phases.

Reasons:

- A parent may have a child in Academy and Club.
- Students may use Academy writing tools, Club meetings, and Tech AI products.
- Admin staff should not maintain separate accounts in every product.
- Shared identity makes password reset, MFA, auditing, and account deactivation cleaner.

### Phased Auth Plan

Phase 1: App-specific login

- Keep Academy and Club auth separate while products are still evolving.
- Harden each app: password reset, secure cookies, rate limiting, audit logs.
- Avoid a premature central auth rewrite.

Phase 2: Shared identity schema

- Add `auth_shared.users`, `auth_shared.identities`, `auth_shared.sessions`, and `auth_shared.app_memberships`.
- Keep app-specific profiles in each app schema.
- Link app users to shared identity IDs.
- Use one login page if apps are under a central auth domain.

Phase 3: Dedicated identity service or managed provider

- Use `auth.ileapapps.com` or a managed provider.
- Support OIDC/OAuth-style login flows.
- Add MFA for admins.
- Add invitation workflows.
- Add centralized password reset.
- Add account disablement across all apps.

### SSO Across Different Domains

iLEAP apps may live on different root domains:

```text
ileapacademy.com
ileapclub.com
ileaptechai.com
```

Browser cookies cannot be shared directly across these unrelated root domains. For real SSO, use one of:

- central auth domain: `auth.ileapapps.com`
- managed auth provider: Clerk, Auth0, Microsoft Entra External ID, Cognito, or similar
- custom OIDC-style auth service hosted on Render

Recommendation:

- Use app-specific auth for the next production step.
- Design schemas with future `shared_identity_id`.
- Adopt shared identity before building the third major private app.
- Use managed auth if MFA, SSO, social login, or enterprise login becomes important.

## Shared Services

### Email

Use one email provider account with separate sending identities:

```text
academy@ileapacademy.com
no-reply@ileapclub.com
support@ileaptechai.com
```

Recommended providers:

- Resend
- Postmark
- SendGrid
- AWS SES

Use a background worker for:

- invites
- password resets
- meeting reminders
- parent notifications
- payment receipts
- admin alerts

Store email events in `audit_shared` or app schemas depending on sensitivity.

### File Storage

Use Cloudflare R2 or S3-compatible storage for all user-generated and generated files.

Buckets:

```text
ileap-prod-academy
ileap-prod-club
ileap-prod-tech-ai
ileap-prod-shared
```

Objects:

- Academy resources and writing attachments
- Club agendas, resources, certificates, worksheets
- Tech AI uploads, generated reports, transcripts
- Admin exports

Rules:

- PostgreSQL stores metadata.
- Object storage stores files.
- Use private buckets by default.
- Use signed URLs for private downloads.
- Do not rely on Render persistent disk for long-term user data.

### Logging

Start with Render logs and structured application logs.

Add later:

- Sentry for frontend/backend errors
- Better Stack, Axiom, Datadog, or Logtail for log aggregation
- OpenTelemetry when services multiply

Minimum fields:

```text
timestamp
service
environment
request_id
user_id or shared_identity_id
tenant_id or centre_id
route
status
duration_ms
error_code
```

### Monitoring

Minimum:

- Render health checks per service
- Render service metrics
- uptime monitor for each public/private domain
- error alerts for 5xx spikes
- database storage and connection monitoring
- AI cost and token monitoring

Recommended external monitors:

- UptimeRobot, Better Stack, or Pingdom for uptime
- Sentry for exceptions
- Render notifications for deploy and service failures

### Backups

Production must use paid PostgreSQL.

Backup policy:

- Enable Render paid Postgres backup/PITR features.
- Test restore quarterly.
- Export before major migrations.
- Keep object storage lifecycle and retention rules.
- Maintain a documented restore plan by schema.

Shared database warning:

- Database-level point-in-time restore rolls back all schemas.
- For one-app incidents, prefer schema-level export/import into a clean database.
- Separate databases later if independent restore becomes a business requirement.

### AI Services

Centralize AI configuration and cost controls:

- shared OpenAI account/project management
- per-app API keys if possible
- model allowlist
- monthly app budgets
- request logging without storing sensitive prompts unnecessarily
- rate limits per user and tenant
- worker queue for long-running jobs
- retry and timeout policy

Academy already uses OpenAI for writing feedback. Club plans future AI speaking coach and rubric analysis. Tech AI will likely become the largest AI consumer, so it should have separate rate limits and possibly its own database later.

## Domain Strategy

Use product-specific domains for public trust, and a neutral iLEAP platform domain for shared infrastructure.

Recommended:

```text
english.ileapacademy.com       -> current Academy English writing portal
academy.ileapacademy.com       -> broader Academy portal later
memberportal.ileapclub.com     -> Club member portal
tech.ileaptechai.com           -> Tech AI portal
admin.ileapapps.com            -> cross-app admin portal
auth.ileapapps.com             -> shared identity service
status.ileapapps.com           -> public/internal status page later
```

Alternative if `ileap.com` is available:

```text
academy.ileap.com
club.ileap.com
tech.ileap.com
admin.ileap.com
auth.ileap.com
```

Keep the marketing websites separate:

```text
ileapacademy.com
ileapclub.com
ileaptechai.com
```

DNS rules:

- Each private app subdomain points to its own Render service.
- Render manages TLS certificates.
- Admin and auth should have stricter access controls.
- Use Cloudflare DNS if possible for centralized DNS management, WAF options, and easy domain inventory.

## CI/CD Strategy With GitHub Actions

Use GitHub Actions as the quality gate. Let Render perform the final build/deploy after GitHub checks pass, or trigger Render deploy hooks after successful workflows.

### Per-Repository CI

For each app repo:

```text
pull_request:
  - install dependencies
  - typecheck
  - lint, when configured
  - run unit tests, when available
  - prisma generate
  - build client
  - build server
  - optional API smoke tests

main branch:
  - same checks
  - deploy to staging or trigger Render preview
  - manual approval for production, if needed
```

### Database Migration CI

Before production:

- Verify Prisma schema format.
- Run migrations against a disposable test database.
- Block destructive migrations without review.
- Generate migration diff in pull request comments if possible.

### Environments

Use three environments:

```text
development
staging
production
```

Minimum:

- staging Render services for Academy and Club before high-traffic production
- separate staging PostgreSQL database
- separate staging R2 buckets
- separate staging email sender or sandbox mode
- no production secrets in GitHub Actions logs

### Render Deployment Flow

Recommended flow:

1. Developer opens pull request.
2. GitHub Actions runs checks.
3. Pull request is reviewed and merged.
4. Render auto-deploys the affected service.
5. Render runs app-scoped migrations.
6. Health check must pass.
7. If deploy fails, roll back only the affected service.

For high-risk migrations, disable auto-deploy and use manual production deploy windows.

## Cost Estimates

These are planning estimates based on Render pricing checked June 26, 2026. They exclude paid auth providers, email volume, OpenAI usage, Stripe fees, domain registration, and object storage usage.

Render reference prices used:

- Starter web service: about $7/month
- Standard web service: about $25/month
- Pro web service: about $85/month
- Basic Postgres 1 GB: about $19/month
- Pro Postgres 4 GB: about $55/month
- Pro Postgres 8 GB: about $100/month
- Render Key Value Starter: about $10/month
- Cron jobs: from about $1/month plus usage
- Pro workspace: about $25/month plus compute
- Scale workspace: about $499/month plus compute

### Development

Target: active development, demos, no real production data.

```text
Public static sites: Cloudflare Pages or Render Static Sites
1-2 temporary Render services as needed
Free or low-tier database only for short-lived testing
No shared production auth
No paid worker unless needed
```

Estimated cost:

| Item | Estimate |
| --- | ---: |
| Render Hobby workspace | $0/month |
| Temporary Starter services | $0-$14/month |
| Temporary Postgres | $0-$19/month |
| Object storage/email/AI | usage-based |
| Total | about $0-$35/month |

### Small Production, About 500 Users

Target: real users, low traffic, Academy + Club + Tech AI private apps.

```text
3 Starter web services
1 Basic 1 GB Postgres
1 small cron job
Cloudflare R2 for files
Render Pro workspace if team/production features are needed
```

Estimated cost:

| Item | Estimate |
| --- | ---: |
| 3 Starter web services | $21/month |
| Basic Postgres 1 GB | $19/month |
| Cron jobs | $1-$5/month |
| Optional Pro workspace | $25/month |
| Object storage/email/AI | usage-based |
| Total without Pro workspace | about $41-$45/month |
| Total with Pro workspace | about $66-$70/month |

### Medium Production, About 2,000 Users

Target: regular usage, more meetings, AI feedback, notifications, admin workflows.

```text
3 Standard web services
1 Starter or Standard background worker
1 Pro Postgres 4 GB or 8 GB
1 Render Key Value service for queues/cache
cron jobs
staging services for the busiest apps
```

Estimated cost:

| Item | Estimate |
| --- | ---: |
| 3 Standard web services | $75/month |
| 1 Starter/Standard worker | $7-$25/month |
| Pro Postgres 4 GB or 8 GB | $55-$100/month |
| Render Key Value Starter | $10/month |
| Cron jobs | $5-$15/month |
| Pro workspace | $25/month |
| Staging services | $20-$75/month |
| Object storage/email/AI | usage-based |
| Total | about $197-$325/month before AI/email/storage usage |

### Large Production, 10,000+ Users

Target: multiple active products, high usage, AI workloads, stricter operations.

```text
Standard/Pro web services per app
separate auth service
separate worker services
Pro or Accelerated Postgres
possible separate databases for Academy, Club, Tech AI
Render Key Value Standard or higher
Scale workspace if governance/compliance is needed
external logging/monitoring
```

Estimated cost:

| Item | Estimate |
| --- | ---: |
| 4-6 Standard/Pro web services | $100-$510/month |
| 2-4 workers | $50-$340/month |
| One large Postgres or multiple Postgres DBs | $200-$800+/month |
| Key Value Standard/Pro | $32-$135/month |
| Cron jobs | $10-$50/month |
| Pro or Scale workspace | $25-$499/month |
| External monitoring/logging | $50-$500+/month |
| Object storage/email/AI | usage-based |
| Total | about $467-$2,800+/month before heavy AI usage |

AI can become the dominant cost for Academy feedback, Club speaking coach, and Tech AI products. Track AI cost separately by app from the beginning.

## Five-Year Growth Roadmap

### Year 1: Stabilize Shared Production

- Keep Academy and Club in separate repositories.
- Deploy each private app as its own Render web service.
- Upgrade production PostgreSQL to a paid plan.
- Use schema separation.
- Move uploads and generated files to Cloudflare R2.
- Add staging for Academy and Club.
- Add basic GitHub Actions checks.
- Harden auth with secure cookies, password reset, rate limiting, and audit logs.
- Add uptime monitoring and error reporting.

### Year 2: Shared Platform Foundation

- Introduce shared identity planning with `shared_identity_id`.
- Add shared email service and email worker.
- Add shared logging conventions.
- Add `auth_shared` and `audit_shared` schemas if custom auth remains.
- Standardize app environment variables.
- Add Club meeting reminders and agenda generation jobs.
- Add common UI/auth/email/storage packages if duplication grows.

### Year 3: SSO And Operational Scale

- Launch shared login using a managed provider or dedicated auth service.
- Add MFA for admins and staff.
- Add cross-app admin portal.
- Add queue-backed AI and document workers.
- Add Render Key Value or another Redis-compatible queue/cache.
- Add better monitoring, dashboards, and cost reporting.
- Split the most resource-heavy app into a separate database if needed.

### Year 4: Product Expansion

- Support Tech AI as a first-class product with its own service, schema, and AI budget.
- Add analytics/reporting database or warehouse if reporting loads affect production.
- Add advanced Club competition workflows, certificates, and resource library.
- Add cross-product user profile and entitlement management.
- Improve role-based access across organizations, centres, and tenants.

### Year 5: Enterprise Readiness

- Move high-scale or high-risk apps to separate databases.
- Evaluate Render Scale or Enterprise if governance, compliance, SAML, or uptime SLA requirements justify it.
- Add disaster recovery runbooks and annual restore tests.
- Add central audit reporting.
- Add formal data retention policies.
- Add tenant-level billing, quotas, and usage analytics if products are sold to schools or franchises.

## Final Architecture Decision

Recommended architecture for the next production phase:

- Keep current repos separate.
- Use one Render account/workspace.
- Use one Render web service per private app.
- Host static marketing sites separately.
- Use one paid PostgreSQL instance with separate schemas.
- Add workers only for email, document generation, and AI when those workloads become real.
- Delay API gateway until external/public API needs exist.
- Build toward shared identity, but do not block current deployments on SSO.
- Use GitHub Actions as the quality gate before Render deploys.

This approach supports low cost now, 500-2,000 users without major redesign, and a clear path to 10,000+ users by splitting services and databases only when usage proves the need.
