# iLEAP Academy Family Portal

A full-stack starter for an iLEAP Academy family portal with parent/student workflows.

## Features

- Email/password login with member and admin roles
- Family profile with address, phone, and emergency contact
- Student and parent profile management
- Program listing and student enrollment
- Payment ledger view
- Class calendar and academy announcements
- Admin family snapshot
- Optional OpenAI-powered iLEAP support assistant

## Local Setup

```powershell
Copy-Item .env.example .env
npm install
npm run prisma:generate
npm run db:push
npm run db:seed
npm run dev
```

Then open `http://localhost:5173`.

Seed accounts:

- `member@example.com` / `Member123!`
- `admin@example.com` / `Member123!`

## Environment

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="replace-this-with-a-long-random-secret"
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-4.1-mini"
PORT="4000"
```

For production PostgreSQL, change `prisma/schema.prisma` datasource provider from `sqlite` to `postgresql` and set `DATABASE_URL` to the managed database connection string.

## Core API

- `POST /api/auth/login`
- `GET /api/household`
- `PUT /api/household`
- `POST /api/members`
- `PUT /api/members/:id`
- `GET /api/programs`
- `POST /api/registrations`
- `GET /api/events`
- `GET /api/messages`
- `GET /api/admin/households`
- `POST /api/assistant`
