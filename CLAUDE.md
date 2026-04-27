# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

License key management system with a React SPA admin dashboard and Express.js backend. Keys are generated in batches, consumed once-per-machine via fingerprint binding, and verified with HMAC-SHA256 signatures.

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with Vite HMR (tsx server.ts) |
| `npm start` | Start production server (node server.ts) |
| `npm run build` | Build frontend SPA into `dist/` |
| `npm run lint` | TypeScript type check (tsc --noEmit) |
| `npm run clean` | Remove `dist/` directory |

No test suite is configured.

## Architecture

### Backend (`server.ts` + `server/`)

Single-file Express server serving dual purposes:

- **Client API** (`POST /api/v1/verify`) — license verification endpoint for client applications. Handles one-time consumption (first use binds to machine fingerprint) and subsequent verifications.
- **Admin API** (`/api/admin/*`) — dashboard endpoints for stats, listing, batch generation, revocation, and unbinding.
- **Dev mode** — uses Vite middleware for HMR.
- **Prod mode** — serves static files from `dist/`.

Supporting modules:
- `server/db.ts` — SQLite database initialization with WAL mode, schema defines `license_keys` and `license_consumptions` tables.
- `server/utils.ts` — `generateOne()` creates Base32 license keys (4-segment format like `ABCD-1234-EFGH-5678`), `sign()` creates HMAC-SHA256 signatures.

### Frontend (`src/`)

Single-file React application (`src/App.tsx`) with state-based routing (no router). Three views: Dashboard, Generate (batch key creation), and List (searchable/paginated table). Styled with Tailwind CSS 4.

### Key Design Patterns

- SQLite via `better-sqlite3` with synchronous queries and explicit transactions for multi-step operations.
- License keys are consumed once: first verification binds to a machine fingerprint; subsequent verifications on different machines are rejected.
- Admin API has no authentication — assume it runs behind a proxy or on a private network.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `NODE_ENV` | — | Set to `production` for prod mode |
| `HMAC_SECRET` | `default-secret-change-it` | HMAC signing secret |
| `DB_PATH` | `cwd/license.db` | SQLite database file path |

## Important Notes

- The admin API endpoints have no authentication middleware. Any authenticated access is assumed to be handled externally.
- The SQLite database file (`license.db`) is gitignored but lives in the project root by default.
- Key generation uses `INSERT OR IGNORE` — duplicate key collisions are silently skipped.
- The spec document at `license-server-spec.md` contains detailed requirements and design rationale if deeper context is needed.
