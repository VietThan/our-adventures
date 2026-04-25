# our-adventures

A private full-stack activity tracker for Viet and Linh.

## Status

Phase 1 implementation in progress. The app now has a real database contract, seed/bootstrap path, Auth.js v5 wiring, and the first authenticated dashboard flow under `apps/web/`.

## Local Development

Start the local PostgreSQL container:

```bash
docker compose up -d
```

This starts Postgres on port `5432` with:

- database: `vietthan`
- user: `postgres`
- password: `postgres`

Then bootstrap Phase 1:

```bash
cd apps/web
npm install

cd ..
node scripts/migrate.mjs

VIET_EMAIL="viet@example.com" \
LINH_EMAIL="linh@example.com" \
node scripts/bootstrap-phase1.mjs
```

Replace the two email values with the real allowlisted Google accounts for Viet and Linh.

Create `apps/web/.env.local` with:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/vietthan
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
AUTH_SECRET=...
VIET_EMAIL=...
LINH_EMAIL=...
```

Then run the app:

```bash
cd apps/web
npm run dev
```

## Phase 1 Flow

- signed-out landing screen with Google sign-in
- DB-backed allowlist seeded through `scripts/bootstrap-phase1.mjs`
- activity list with category, search, and `undone by me` / `all`
- shared status markers for Viet and Linh
- inline detail panel with timestamps
- binary complete / uncomplete actions
- random picker that respects active filters

## Scripts

- `docker compose up -d`
  - starts only the local Postgres service and persistent data volume
  - does not auto-apply schema files
- `node scripts/migrate.mjs`
  - applies all SQL files in `db/migrations/`
  - suitable for routine local resets and production deploy steps
  - reads `apps/web/.env.local` automatically when present
- `node scripts/bootstrap-phase1.mjs`
  - runs migrations
  - seeds Viet/Linh idempotently
  - imports baseline activities once if the table is empty
  - intended for first-time environment bootstrap
  - reads `apps/web/.env.local` automatically when present

## Production First-Time Seed

Routine deploys should rely on `.github/workflows/deploy-app.yml`, which now runs
all files in `db/migrations/` in filename order.

For the one-time production seed, use the checked-in SQL file:

- [data/001_phase1_seed.sql](/Users/vietthan/projects/workspace-viett/our-adventures/data/001_phase1_seed.sql:1)

Before running it:

1. Replace the placeholder `viet@example.com` and `linh@example.com` values with the real production emails.
2. Run it only after migrations have been applied.
3. Run it only once against an empty `our_adventures.activities` table.

The file intentionally aborts if activities already exist, so it cannot silently
double-seed the baseline catalog.
