# AGENTS.md

This file provides guidance to coding agents when working with code in this repository.

## What this is

A full-stack couples' activity tracker for Viet and Linh. Replaces a frontend-only prototype (`nyc-adventure`) with real data persistence. Private — 2 users only.

## Architecture

Monorepo with three packages:

- **`apps/api/`** — Fastify (Node.js/TypeScript) REST API on port `3001`. No ORM — raw `pg` queries in `src/db/queries/`. Auth via Auth.js JWT cookie verified with shared `AUTH_SECRET`.
- **`apps/web/`** — Next.js (App Router, server mode, TypeScript, Tailwind) on port `3000`. Auth.js handles Google OAuth. Never `output: 'export'` — server mode is required for Auth.js routes.
- **`infra/`** — AWS CDK (TypeScript). Three stacks: `network` (VPC), `database` (RDS PostgreSQL t4g.micro), `compute` (EC2 t4g.nano). Run manually, not in CI.

In production, both apps run on a single EC2 t4g.nano behind nginx:
- `/api/v1/*` → Fastify (3001)
- everything else → Next.js (3000)

## Database

PostgreSQL. Three tables: `activities`, `users`, `completions`. See `apps/api/migrations/001_initial_schema.sql` for the full schema.

Migrations use `node-pg-migrate`. Run via `npm run migrate` in `apps/api/`.

## Local development

Requires Docker. Start the local Postgres instance:

```bash
docker compose up -d
```

This starts Postgres on port `5432` with database `our_adventures`, user `postgres`, password `postgres`.

Each app reads `DATABASE_URL` from a `.env.local` file — copy `.env.local.example` if present.

## Auth

Auth.js (NextAuth v5) with Google provider. The `signIn` callback enforces an email allowlist — only the two configured emails can log in. `AUTH_SECRET` is shared between `apps/web` and `apps/api` so Fastify can verify Auth.js JWT cookies.

Required env vars for auth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`.

## Deployment

GitHub Actions — two workflows:

- **`deploy-app.yml`** — triggers on push to `main`. Builds API + web, rsyncs to EC2, runs migrations, restarts both systemd services via SSH.
- **`deploy-infra.yml`** — manual trigger only. Runs `cdk deploy`.

Infra changes (`infra/`) are never deployed automatically.

## Planning docs

`ai/` contains planning documents for this project. Check there for architectural decisions and rationale before making structural changes.
