# our-adventures

A private full-stack activity tracker for Viet and Linh.

## Status

Phase 1 is complete. The app has a real database contract, seed/bootstrap path,
Auth.js v5 wiring, and an authenticated dashboard flow under `apps/web/`.

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

Routine deploys should rely on `.github/workflows/deploy-app.yml`, which reads
the current EC2 public IP from SSM and runs all files in `db/migrations/` in
filename order.

For the one-time production seed, use the checked-in SQL file:

- [data/001_phase1_seed.sql](/Users/vietthan/projects/workspace-viett/our-adventures/data/001_phase1_seed.sql:1)

Before running it:

1. Replace the placeholder `viet@example.com` and `linh@example.com` values with the real production emails.
2. Run it only after migrations have been applied.
3. Run it only once against an empty `our_adventures.activities` table.

The file intentionally aborts if activities already exist, so it cannot silently
double-seed the baseline catalog.

## Production Troubleshooting

If the deployed app is up but something like sign-in or API requests fails, get
the `web` service logs from the EC2 instance first.

Open an SSM session:

```bash
INSTANCE_ID=$(aws ec2 describe-instances \
  --filters "Name=tag:aws:cloudformation:stack-name,Values=ComputeStack" "Name=instance-state-name,Values=running" \
  --query 'Reservations[0].Instances[0].InstanceId' \
  --output text \
  --profile VietThan-Admin-SSO)

aws ssm start-session --target "$INSTANCE_ID" --profile VietThan-Admin-SSO
```

Then inspect the service logs:

```bash
sudo journalctl -u web -n 200 --no-pager
```

To follow new lines live while reproducing a bug in the browser:

```bash
sudo journalctl -u web -f
```

This is the fastest way to catch production-only issues such as:

- Auth.js host trust errors
- missing or invalid environment variables
- database connection failures
- migration/runtime mismatches after deploy

For raw HTTP request activity, use nginx logs instead:

```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## Production Database TLS

Production database connections verify the RDS certificate with the AWS RDS
global CA bundle at `/etc/ssl/certs/rds-combined-ca-bundle.pem`. The EC2 user
data installs that bundle during instance boot, and production startup fails if a
remote database connection needs TLS but the bundle is missing.
