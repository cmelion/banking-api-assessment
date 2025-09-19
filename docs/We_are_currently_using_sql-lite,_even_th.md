### Goal
Migrate the app from SQLite to PostgreSQL for both local development (Docker Compose) and production (Vercel + Vercel Postgres), while keeping a single seeding workflow you can run locally and against production.

---

### Executive Summary (What we’ll do)
- Switch Prisma datasource from `sqlite` to `postgresql`.
- Update `docker-compose.yml` to run PostgreSQL locally and point the API at it.
- Keep your Prisma models the same, generate a fresh migration for Postgres, and reset DB locally.
- Use Vercel Postgres in production with the Vercel-provided `POSTGRES_*` env vars.
- Configure Prisma to use pooled connections at runtime and direct (non-pooled) connection for migrations.
- Add CI that runs against Postgres (service or Docker Compose), runs migrations/seeds, and executes tests.
- Provide a safe, repeatable way to seed the Vercel (production or preview) database with the same script you use locally.

---

### 1) Prisma: move from SQLite to PostgreSQL

#### Change Prisma datasource
Update `prisma/schema.prisma` provider and add `directUrl` for migrations. Keep your existing models unchanged unless you want to tune column types explicitly.

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")           // Runtime connection (pooled on Vercel)
  directUrl = env("DIRECT_URL")             // Non-pooled for migrations/seeding
}

// ... your existing models unchanged ...
```

Notes:
- Prisma will map `Decimal` to Postgres `numeric` by default; no change required unless you want to specify precision via `@db.Decimal(18,2)`.
- You will lose existing SQLite data; since this is a demo, the plan resets the DB and relies on seed data.

#### Create a fresh migration for Postgres
- After updating the datasource, in local dev:

```bash
npm run db:generate
npm run db:migrate # prisma migrate dev (will create a Postgres migration)
```

If Prisma complains about changing providers from SQLite to Postgres, run a reset (dev only):

```bash
npm run db:reset # prisma migrate reset --force
```

Then re-seed:

```bash
npm run db:seed
```

---

### 2) Local Development: Docker Compose using Postgres

Update `docker-compose.yml` so the API uses Postgres instead of SQLite. Replace the API env `DATABASE_URL` with a Postgres URL and add a `DIRECT_URL` for migrations/seeding.

```yaml
# docker-compose.yml (only the relevant parts)
services:
  banking-api:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      - NODE_ENV=development
      - PORT=3000
      - DATABASE_URL=postgresql://xxx:xxx@postgres:5432/banking_db?schema=public
      - DIRECT_URL=postgresql://xxx:xxx@postgres:5432/banking_db?schema=public
      - JWT_SECRET=your-development-jwt-secret-change-in-production
      - JWT_REFRESH_SECRET=your-development-refresh-secret-change-in-production
      - JWT_ACCESS_EXPIRY=15m
      - JWT_REFRESH_EXPIRY=7d
      - LOG_LEVEL=info
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - banking-network

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: banking_db
      POSTGRES_USER: serena
      POSTGRES_PASSWORD: xxx
      POSTGRES_INITDB_ARGS: "--auth-host=scram-sha-256 --auth-local=scram-sha-256"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U banking_user -d banking_db"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
```

Clean up SQLite-specific volume mounts from the API service (you can keep mounting `./src` and `./prisma` if you like). The `banking-data` volume used for SQLite can be removed.

Local workflow after changes:

```bash
# start services
docker compose up -d

# run Prisma against the running container (optional) or locally
docker compose exec banking-api npm run db:migrate
docker compose exec banking-api npm run db:seed
```

---

### 3) App code: Prisma client stays the same
Your `src/db/connection.ts` already centralizes Prisma client creation. No change is strictly required; it will pick up `DATABASE_URL` from the environment. With Postgres, `checkDatabaseHealth` using `SELECT 1` is fine.

---

### 4) Vercel Production: Vercel Postgres + Prisma

Vercel Postgres provides several environment variables after you add the integration. Important ones:
- `POSTGRES_PRISMA_URL` – pooled connection string intended for Prisma at runtime.
- `POSTGRES_URL_NON_POOLING` – direct (non-pooled) connection string for migrations.

Set these on Vercel (Project Settings → Environment Variables):
- `DATABASE_URL` = `${POSTGRES_PRISMA_URL}`
- `DIRECT_URL` = `${POSTGRES_URL_NON_POOLING}`
- Keep your JWT secrets, etc.

Runtime/practices on Vercel:
- Prisma + Vercel Postgres works best with pooled connections. Using `POSTGRES_PRISMA_URL` satisfies that.
- If you see connection limits in serverless, consider enabling Prisma Accelerate. That requires adding the Accelerate URL secret and optionally `PRISMA_CLIENT_ENGINE_TYPE=dataproxy`. This is optional if `POSTGRES_PRISMA_URL` is used.

Migrations on Vercel:
- Vercel builds should not apply DB migrations automatically (builds run in a sandbox, and you want more control). Instead, apply migrations via:
  - A GitHub Action job (manual dispatch or on deploy), or
  - `vercel exec` after deployment if you prefer a push-button approach.

Recommended: a GitHub Actions workflow that, when manually triggered, runs migrations and seeding against production using the Vercel-provided secrets.

---

### 5) Unified seeding for local and production
You already have `src/db/seed.ts`. Keep it as the single source of truth. It uses the Prisma client, so it will connect to whichever DB is in `DATABASE_URL`/`DIRECT_URL`.

- Local dev: `npm run db:seed` while `DIRECT_URL` points at local Postgres.
- Production (Vercel): Run the same script from CI using `DIRECT_URL` = `POSTGRES_URL_NON_POOLING` (for a dedicated, direct connection) and `DATABASE_URL` = `POSTGRES_PRISMA_URL` (for Prisma client runtime within the script). In practice, Prisma migrations use `DIRECT_URL`; your seed script uses the Prisma client which defaults to `DATABASE_URL`.

If you want to force the seed script to always use the direct (non-pooled) URL to avoid idle session behavior in serverless, you can temporarily override `DATABASE_URL` to `DIRECT_URL` for the seed step only.

Example seed command targeting production safely (CI):

```bash
# ensure migrations are applied first
npx prisma migrate deploy

# run seed using direct URL
DATABASE_URL="$DIRECT_URL" npm run db:seed
```

---

### 6) GitHub Actions CI: run tests against Postgres and support seeding production

Two jobs: (A) CI for PRs, (B) a manually-triggered prod seed/migrate job.

#### A) Typical CI (PRs, pushes)
Option 1: Use GitHub Actions services:
```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: banking_db
          POSTGRES_USER: serena
          POSTGRES_PASSWORD: xxx
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U banking_user -d banking_db" \
          --health-interval 10s --health-timeout 5s --health-retries 5
    env:
      DATABASE_URL: postgresql://xxx:xxx@localhost:5432/banking_db?schema=public
      DIRECT_URL: postgresql://xxx:xxx@localhost:5432/banking_db?schema=public
      JWT_SECRET: test
      JWT_REFRESH_SECRET: test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npx prisma generate
      - run: npx prisma migrate deploy
      - run: npm run db:seed
      - run: npm test
```

Option 2: Use your `docker-compose.yml` in CI (if your tests need Redis/Adminer too):
```yaml
# key steps only
- run: docker compose up -d postgres redis
- run: until docker compose exec -T postgres pg_isready -U banking_user -d banking_db; do sleep 2; done
- run: npm ci && npx prisma generate && npx prisma migrate deploy && npm run db:seed && npm test
```

#### B) Manual workflow to migrate + seed Vercel DB
```yaml
# .github/workflows/db-admin.yml
name: DB Admin
on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target Vercel environment (production|preview)'
        required: true
        default: 'production'

jobs:
  migrate-seed:
    runs-on: ubuntu-latest
    environment: ${{ github.event.inputs.environment }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npx prisma generate
      - name: Apply migrations
        env:
          DATABASE_URL: ${{ secrets.POSTGRES_PRISMA_URL }}
          DIRECT_URL:   ${{ secrets.POSTGRES_URL_NON_POOLING }}
        run: npx prisma migrate deploy
      - name: Seed database
        env:
          DATABASE_URL: ${{ secrets.POSTGRES_URL_NON_POOLING }} # force direct for seed
        run: npm run db:seed
```

Configure repository/environment secrets in GitHub to mirror Vercel’s `POSTGRES_PRISMA_URL` and `POSTGRES_URL_NON_POOLING` for the chosen environment(s).

---

### 7) Vercel project settings
- Add Vercel Postgres integration to your project.
- In Project Settings → Environment Variables:
  - `DATABASE_URL` = `POSTGRES_PRISMA_URL`
  - `DIRECT_URL`   = `POSTGRES_URL_NON_POOLING`
  - Add JWT secrets and other config your app expects.
- Redeploy the project after saving env vars.

Optional (if needed due to connection limits):
- Add Prisma Accelerate; set `PRISMA_ACCELERATE_URL` secret and follow Prisma docs to enable Accelerate in the client. For most apps, `POSTGRES_PRISMA_URL` pooling is sufficient.

---

### 8) Developer UX and commands
Add or adjust scripts in `package.json` for clarity:

```json
{
  "scripts": {
    "db:generate": "prisma generate",
    "db:migrate":  "prisma migrate dev",
    "db:migrate:deploy": "prisma migrate deploy",
    "db:reset":    "prisma migrate reset --force",
    "db:seed":     "tsx src/db/seed.ts",

    "docker:up":   "docker compose up -d",
    "docker:down": "docker compose down"
  }
}
```

Common flows:
- First-time local setup: `docker compose up -d && npm run db:migrate && npm run db:seed`
- Reset local DB: `npm run db:reset && npm run db:seed`
- Update schema: edit models → `npm run db:migrate` → commit migration

---

### 9) Data model differences and gotchas moving to Postgres
- Unique/index names: Prisma generates index names differently across providers; migrations handle this.
- String enums: you’re storing strings (e.g., `type`, `status`). That’s fine. Optionally convert to Postgres native enums in the future for stricter constraints.
- Decimals: Postgres `numeric` is precise. If you want to cap precision/scale, add `@db.Decimal(18,2)` to money fields.
- Timestamps: Postgres defaults to `timestamptz`; Prisma uses `timestamp` unless specified. If you need timezone-aware storage, consider switching to `@db.Timestamptz(6)`.

---

### 10) Rollout and rollback
- Rollout:
  1) Merge Prisma datasource change and new migration.
  2) Update local `.env` and `docker-compose.yml`, verify local dev works.
  3) Add Vercel env vars and redeploy.
  4) Run the GitHub `DB Admin` workflow to apply migrations and seed production.
- Rollback:
  - Because SQLite → Postgres is a one-way jump, rollback means switching env vars back to SQLite and restoring old code. For a demo, simpler rollback is to redeploy prior commit and restore the old SQLite file/volume locally. In Vercel, you can re-point env vars or redeploy the previous build.

---

### 11) Validation checklist
- Local: `GET /health` returns 200 after migrations. Users/accounts/transactions present after `npm run db:seed`.
- CI: Tests pass against Postgres service. Coverage normal.
- Vercel: API works; no connection limit errors; Admin workflow migrates/seeds successfully.

---

### Appendix: Example `.env` files

Local `.env` for Docker or local Node runs (avoid committing secrets):
```ini
# Local Postgres
DATABASE_URL=postgresql://xxx:xxx@localhost:5432/banking_db?schema=public
DIRECT_URL=postgresql://xxx:xxx@localhost:5432/banking_db?schema=public

JWT_SECRET=dev-secret
JWT_REFRESH_SECRET=dev-refresh
```

Vercel (set in Dashboard, not committed):
```ini
DATABASE_URL=${POSTGRES_PRISMA_URL}
DIRECT_URL=${POSTGRES_URL_NON_POOLING}
JWT_SECRET=prod-secret
JWT_REFRESH_SECRET=prod-refresh
```

---

### That’s it
This plan gives you:
- One ORM (Prisma), one schema, one seeding script.
- Postgres everywhere (local, CI, Vercel) with appropriate pooling.
- Controlled migrations and identical seed data in all environments.