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
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/vietthan \
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

- `node scripts/migrate.mjs`
  - applies all SQL files in `db/migrations/`
  - suitable for routine local resets and production deploy steps
- `node scripts/bootstrap-phase1.mjs`
  - runs migrations
  - seeds Viet/Linh idempotently
  - imports baseline activities once if the table is empty
  - intended for first-time environment bootstrap
