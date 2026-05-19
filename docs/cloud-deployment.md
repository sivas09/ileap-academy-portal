# Cloud Deployment

## Recommended Production Stack

- Web/API: Azure App Service, AWS Elastic Beanstalk, Render, Fly.io, or Railway
- Database: Azure Database for PostgreSQL, AWS RDS PostgreSQL, Neon, Supabase, or Railway PostgreSQL
- Files/photos: Azure Blob Storage or AWS S3
- Email: SendGrid, Postmark, or AWS SES
- Payments: Stripe Checkout or Stripe Payment Element for classes, subscriptions, iCAT tests, and eBooks
- LLM: OpenAI API with server-side calls only
- Auth upgrade: Auth0, Clerk, Azure AD B2C, or custom session cookies with MFA

## Deployment Steps

1. Create a production PostgreSQL database.
2. Update `prisma/schema.prisma` datasource provider to `postgresql`.
3. Set production environment variables:

```env
DATABASE_URL="postgresql://..."
JWT_SECRET="long-random-secret"
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-4.1-mini"
PORT="4000"
```

4. Build and migrate:

```bash
npm install
npm run prisma:generate
npm run db:push
npm run build
npm start
```

5. Configure HTTPS, custom domain, and CORS origin restrictions.
6. Add daily database backups and error monitoring.

## Production Hardening

- Replace bearer token storage in `localStorage` with secure HTTP-only cookies.
- Add password reset and email verification.
- Add audit logs for profile, payment, enrollment, and progress changes.
- Add row-level authorization tests.
- Use object storage for member photos instead of raw URLs.
- Add Stripe webhooks for payment status updates.
- Add rate limiting to login and assistant endpoints.
