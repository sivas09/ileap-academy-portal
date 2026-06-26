# Shared Render Hosting Architecture

Last updated: June 26, 2026

## Goal

Use one cost-controlled Render production setup to host multiple iLEAP applications while keeping each portal isolated enough that a bug, deploy failure, or traffic spike in one app does not take down the others.

Target applications:

- iLEAP Academy portal
- iLEAP Club member portal
- iLEAP Tech AI portal
- Future iLEAP applications
- Optional internal admin portal

## Recommendation

Use **multiple Render web services with one shared paid PostgreSQL database**, separated by PostgreSQL schemas and service-specific environment variables.

This is the best current balance for iLEAP because it keeps monthly cost low, avoids one application process breaking every portal, supports independent deployments, and can scale to 1000+ users before needing a more expensive database split.

Recommended near-term architecture:

- One Render workspace/project for iLEAP production.
- One paid Render PostgreSQL instance.
- One Render web service per major app.
- One PostgreSQL schema per app.
- One shared authentication strategy, implemented as a central auth schema or dedicated auth service when cross-app login is required.
- Shared file storage outside app disks, preferably Cloudflare R2 or S3-compatible storage.
- Monorepo is acceptable if the apps are managed together, but each app should still deploy as its own Render service.

Do not use one combined Render web service for all portals in production. It is cheaper, but one bad deploy, memory leak, dependency conflict, or runtime error can affect every app at once.

## Target Architecture

```text
Users
  |
  | HTTPS
  v
Custom subdomains
  |
  +-- academy.ileapacademy.com       -> Render web service: ileap-academy-portal
  +-- memberportal.ileapclub.com     -> Render web service: ileap-club-member-portal
  +-- tech.ileaptechai.com           -> Render web service: ileap-tech-ai-portal
  +-- admin.ileapapps.com            -> Render web service: ileap-admin-portal
                                           |
                                           v
                                Shared Render PostgreSQL
                                           |
        +----------------------------------+----------------------------------+
        |                                  |                                  |
  Schema: academy_portal           Schema: club_portal              Schema: tech_ai_portal
  Schema: auth_shared              Schema: admin_portal             Schema: audit_shared
```

The important isolation boundary is the Render web service. Each portal has its own build, deploy, runtime process, logs, health check, secrets, and scaling settings. The database is shared only at the infrastructure level.

## Option Comparison

| Option | Description | Pros | Cons | Recommendation |
| --- | --- | --- | --- | --- |
| A | One Render service + one PostgreSQL database | Lowest compute cost, simplest first deploy | One app bug can break all portals, deploys are coupled, harder rollback, dependency conflicts, scaling is all-or-nothing | Avoid for production across Academy, Club, and Tech AI |
| B | Multiple Render services + one PostgreSQL database | Good app isolation, independent deploys, low database cost, easy to operate | Database remains shared infrastructure, migrations require discipline, schema permissions must be controlled | Best architecture for now |
| C | Multiple Render services + separate PostgreSQL databases | Strongest app and data isolation, simpler per-app restore, easier compliance boundaries | Higher monthly cost, more backup/migration/admin work, duplicated shared auth data | Best later for high-risk or high-scale apps |
| D | Monorepo with multiple apps | Shared code, consistent tooling, easier coordinated changes, Render supports monorepos | Repo builds can become slower, ownership boundaries need discipline | Good if paired with Option B service isolation |

Best choice now: **Option B, with Option D if the team wants one repository for shared iLEAP platform code**.

## Production Service Strategy

Create a separate Render web service for each production portal:

- `ileap-academy-portal`
- `ileap-club-member-portal`
- `ileap-tech-ai-portal`
- `ileap-admin-portal`

Each service should have:

- Its own `APP_URL`.
- Its own `APP_DATABASE_SCHEMA`.
- Its own deploy pipeline.
- Its own health check endpoint.
- Its own logs and metrics.
- Its own secret values where possible.
- Its own resource size and scaling plan.

This prevents one app from damaging another at the Node.js process level. For example, if the Tech AI portal has a memory leak, the Academy portal process should keep running.

## Database Strategy

Use one shared paid Render PostgreSQL database at first, with strict schema separation:

```text
Database: ileap-production-db

Schemas:
  auth_shared
  academy_portal
  club_portal
  tech_ai_portal
  admin_portal
  audit_shared
```

Recommended rules:

- Each app reads and writes its own schema only.
- Shared login/account tables live in `auth_shared` only if users need one account across apps.
- Shared audit/security events live in `audit_shared`.
- Each app uses its own database role if practical.
- Migrations must target only that app's schema.
- Never let an app migration modify another app's schema.

Current Academy portal already follows the schema direction with `APP_DATABASE_SCHEMA=english_portal`. For shared hosting, keep that pattern and standardize names before scaling to more apps.

### Render Dashboard Setup For One Shared Database

Yes, one Render PostgreSQL database can be used by multiple iLEAP projects. The practical setup is:

1. Create or upgrade one paid Render PostgreSQL database, preferably named `ileap-production-db`.
2. Keep the current Academy service as its own Render web service.
3. Add the Club member portal as another Render web service in the same Render account.
4. Add Tech AI later as another Render web service in the same Render account.
5. Point every private app service to the same PostgreSQL connection string.
6. Set a different schema per service:

```text
ileap-english-portal       DATABASE_URL=<same Render Postgres connection>  APP_DATABASE_SCHEMA=english_portal
ileap-club-member-portal   DATABASE_URL=<same Render Postgres connection>  APP_DATABASE_SCHEMA=club_portal
ileap-tech-ai-portal       DATABASE_URL=<same Render Postgres connection>  APP_DATABASE_SCHEMA=tech_ai_portal
ileap-admin-portal         DATABASE_URL=<same Render Postgres connection>  APP_DATABASE_SCHEMA=admin_portal
```

In Render's dashboard, this means the later services should **not** create their own PostgreSQL database by default. They should reuse the existing production database connection string and isolate app data through `APP_DATABASE_SCHEMA`.

The current `render.yaml` is still Academy-specific because it creates `ileap-english-portal-db`. Do not use that exact database block as the long-term shared-platform blueprint without renaming/upgrading the database and connecting future services to the same shared database.

### When To Split Databases Later

Move an app to its own PostgreSQL database when any of these become true:

- The app stores unusually sensitive data with different compliance requirements.
- The app has heavy traffic or long-running queries that can affect other portals.
- The app needs independent point-in-time restore without impacting other apps.
- The app has a separate engineering owner or release cycle.
- Database CPU, RAM, storage, or connection limits become the bottleneck.

## Shared Authentication

Use shared authentication only where it creates real user value.

Recommended phases:

1. **Now:** Keep per-app authentication if the user bases are separate.
2. **Next:** Introduce shared identity tables in `auth_shared` for users who need access to multiple apps.
3. **Later:** Move authentication to a dedicated auth provider or auth service if single sign-on, MFA, password reset, social login, or enterprise login becomes important.

Production auth requirements:

- Store sessions in secure HTTP-only cookies, not browser `localStorage`.
- Use separate cookie names per app unless intentionally building SSO.
- Use strong `JWT_SECRET` or session secrets per environment.
- Add role and permission checks at the API layer for every protected route.
- Add audit logs for login, password reset, permission changes, payment actions, and admin actions.

For cross-domain SSO across `ileapacademy.com`, `ileapclub.com`, and `ileaptechai.com`, cookie sharing will not work directly across different root domains. Use a central auth domain such as `auth.ileapapps.com` or a managed provider like Clerk, Auth0, Microsoft Entra External ID, or Cognito if true SSO becomes a requirement.

## Tenant Separation

There are two separation concepts:

- **App separation:** Academy, Club, and Tech AI are different applications.
- **Tenant separation:** Different schools, classes, clubs, companies, or customers inside one app.

Recommended tenant model:

- Use separate schemas for separate apps.
- Use a `tenant_id` column inside each app schema when that app supports multiple organizations.
- Enforce `tenant_id` in every user-owned table.
- Add API authorization tests that prove one tenant cannot read or update another tenant's data.
- Use database indexes that include `tenant_id` for high-volume tables.

Do not create a database per tenant at this stage. That adds cost and operational complexity before it is needed.

## Environment Variables

Use a consistent naming pattern across services:

```env
NODE_ENV=production
APP_NAME=ileap-academy-portal
APP_URL=https://academy.ileapacademy.com
APP_DATABASE_SCHEMA=academy_portal
DATABASE_URL=postgresql://...
JWT_SECRET=...
OPENAI_API_KEY=...
OPENAI_MODEL=...
R2_BUCKET=...
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
SMTP_HOST=...
SMTP_USER=...
SMTP_PASS=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
```

Rules:

- Shared infrastructure values can point to the same database or storage account.
- App-specific secrets should stay app-specific.
- Never reuse production secrets in staging or local development.
- Keep `.env.example` safe and non-secret.
- Use Render secret environment variables for real secrets.

## Backups And Recovery

Use a paid Render PostgreSQL plan before storing real student, payment, or production data. Render's public pricing page currently lists paid Postgres features including logical backup retention, expandable storage, and point-in-time recovery for paid plans.

Minimum backup policy:

- Use paid PostgreSQL, not the 30-day free database, for production.
- Enable daily logical backups or confirm Render's retained backup settings for the chosen plan.
- Test restore into a non-production database at least quarterly.
- Before large migrations, create a manual backup or snapshot/export.
- Store uploaded files in Cloudflare R2 or S3-compatible object storage, not only on a Render persistent disk.
- Keep a runbook for restoring one app schema from backup.

Shared-database caution: point-in-time restore restores the whole database. If only one app is damaged, schema-level export/import may be needed to avoid rolling back every app.

## Security

Baseline security controls:

- HTTPS only on all custom domains.
- Separate Render services and secrets per app.
- Strong production secrets generated outside source control.
- Restrict CORS to the exact production domains.
- Use HTTP-only secure cookies for sessions.
- Add rate limiting to login, password reset, and AI endpoints.
- Validate all file uploads by type and size.
- Store uploads in object storage with private buckets and signed URLs when needed.
- Keep OpenAI and Stripe keys server-side only.
- Use least-privilege database roles if possible.
- Add audit logging for admin and payment workflows.
- Keep dependency updates and security audits on a regular schedule.

## Scaling

Start small, then scale the bottleneck that actually appears.

Initial production:

- One Starter web service per portal.
- One paid PostgreSQL database, likely Basic at first.
- Cloudflare R2 or S3-compatible storage for uploads.

Scale path:

1. Upgrade a busy portal from Starter to Standard.
2. Add caching or queueing for expensive AI, email, or reporting jobs.
3. Upgrade PostgreSQL RAM/CPU/storage as data and traffic grow.
4. Split the busiest or highest-risk portal into its own database.
5. Add horizontal scaling for stateless services if traffic justifies it.

To support 1000+ users, the app should eventually be stateless at the web-service layer. Do not rely on local disk for user uploads or local memory for sessions.

## Cost Estimate

Render pricing changes, so confirm before purchasing. As of June 26, 2026, Render's public pricing page lists:

- Starter web service: about **$7/month** each.
- Standard web service: about **$25/month** each.
- Basic PostgreSQL 256 MB: about **$6/month**.
- Basic PostgreSQL 1 GB: about **$19/month**.
- Pro workspace: **$25/month + compute** if production workspace features are needed.
- Persistent disks: about **$0.25/GB/month**.
- Extra bandwidth and custom domains may add small usage-based charges.

Source: https://render.com/pricing

Estimated monthly cost options:

| Setup | Approximate Monthly Cost | Notes |
| --- | ---: | --- |
| Cheapest production baseline: 3 Starter services + Basic 256 MB Postgres | $27/month | Low cost, limited DB RAM; good for early production if traffic is light |
| Recommended early production: 3 Starter services + Basic 1 GB Postgres | $40/month | Better database headroom while keeping service isolation |
| Add admin portal as Starter service | +$7/month | Only needed if admin is separate from the app dashboards |
| Upgrade one busy portal to Standard | +$18/month per upgraded service | Move only the portal that needs it |
| Render Pro workspace, if required | +$25/month | Adds team/production workspace features; evaluate based on account needs |

Recommended starting budget: **about $40-$72/month**, depending on whether Render Pro workspace and a separate admin service are needed.

## Folder And Repo Structure

Two good structures are possible.

### Preferred If Apps Share Code: Monorepo

```text
ileap-platform/
  apps/
    academy-portal/
    club-member-portal/
    tech-ai-portal/
    admin-portal/
  packages/
    auth/
    database/
    ui/
    config/
    email/
    storage/
  docs/
  render.yaml
```

Use this if iLEAP wants shared UI, auth helpers, database utilities, email templates, and deployment standards.

Render can deploy multiple services from one repo by setting each service's root directory or build commands. Each app should still be a separate Render web service.

### Preferred If Apps Are Independent: Separate Repositories

```text
ileap-academy-portal/
ileap-club-member-portal/
ileap-tech-ai-portal/
ileap-admin-portal/
ileap-shared-packages/
```

Use this if each app has different owners, dependencies, release timing, or security boundaries.

### Recommendation

Use a **monorepo later**, but do not force it immediately if the current Academy portal is already stable as its own repository. For now:

- Keep the Academy portal repo working.
- Add new apps as separate services.
- Move to a monorepo when shared auth, shared UI, and shared deployment tooling are valuable enough to justify the migration.

## Deployment Strategy

Recommended deployment model:

- One Render service per app.
- Automatic deploys from the app's main branch only after tests pass.
- Preview deployments for pull requests when available.
- Database migrations run per app and target only that app's schema.
- Each service has a health check endpoint.
- Roll back only the affected app when a deploy fails.

Example service-to-schema mapping:

| Render Service | Domain | Database Schema |
| --- | --- | --- |
| `ileap-academy-portal` | `academy.ileapacademy.com` or `english.ileapacademy.com` | `academy_portal` or `english_portal` |
| `ileap-club-member-portal` | `memberportal.ileapclub.com` | `club_portal` |
| `ileap-tech-ai-portal` | `tech.ileaptechai.com` | `tech_ai_portal` |
| `ileap-admin-portal` | `admin.ileapapps.com` | `admin_portal`, plus read access where needed |

## Domain And Subdomain Mapping

Recommended production domains:

```text
academy.ileapacademy.com       -> iLEAP Academy portal
english.ileapacademy.com       -> English writing portal, if it remains a separate Academy product
memberportal.ileapclub.com     -> iLEAP Club member portal
tech.ileaptechai.com           -> iLEAP Tech AI portal
admin.ileapapps.com            -> internal admin portal
auth.ileapapps.com             -> future shared authentication, if needed
```

DNS setup:

- Add each custom domain in the matching Render web service.
- Create the CNAME records where the DNS provider is managed.
- Let Render manage TLS certificates.
- Keep admin and auth domains separate from public marketing sites.

## Migration Plan From Current Setup

Do not change `render.yaml` yet. Use this as the planning sequence.

1. **Stabilize current Academy production**
   - Keep the existing Academy/English portal Render service working.
   - Upgrade the production PostgreSQL database from free before real production data is stored.
   - Confirm backups and restore process.

2. **Standardize naming**
   - Decide whether the current `english_portal` schema remains product-specific or becomes `academy_portal`.
   - Keep schema names stable once production data exists.

3. **Create shared production database plan**
   - Choose one paid Render PostgreSQL instance.
   - Define schemas for each app.
   - Define migration ownership rules.

4. **Add the Club portal as its own Render service**
   - Point it to the same PostgreSQL database.
   - Set `APP_DATABASE_SCHEMA=club_portal`.
   - Use its own secrets and health check.
   - Verify it cannot access Academy data.

5. **Add the Tech AI portal as its own Render service**
   - Point it to the same PostgreSQL database.
   - Set `APP_DATABASE_SCHEMA=tech_ai_portal`.
   - Add stricter rate limits and cost controls for AI endpoints.

6. **Move file uploads to object storage**
   - Use Cloudflare R2 or S3-compatible storage.
   - Keep Render persistent disk only as temporary fallback if needed.

7. **Introduce shared authentication only when needed**
   - Start with app-specific auth if faster and safer.
   - Move to `auth_shared` or a managed auth provider when cross-app login is required.

8. **Add admin portal**
   - Build it as a separate service.
   - Give it least-privilege access.
   - Log all admin actions.

9. **Scale selectively**
   - Upgrade only the app or database component under pressure.
   - Split databases only when isolation, restore, or performance requires it.

## Final Decision

The safest low-cost architecture for iLEAP now is:

- **Multiple Render web services**
- **One paid shared Render PostgreSQL database**
- **Separate PostgreSQL schemas per app**
- **Separate environment variables and secrets per service**
- **Object storage for uploads**
- **Optional monorepo later**

This gives iLEAP one shared paid cloud setup while preventing the most likely failure mode: one app bug taking down all iLEAP portals.
