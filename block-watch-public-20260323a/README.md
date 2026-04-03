# Persistent Block Watch Catalog

This Vercel app exposes:

- A server-rendered public catalog of blocked domains.
- A public JSON API for searching documented blocked domains.
- Private admin APIs and an admin dashboard protected by HTTP basic auth.
- A manual ingest path and optional scheduled sync for authorized Securly data.
- A separate lookup-log stream for public search activity.

## Public behavior

- The homepage is rendered from the server on first load so catalog data is visible even before client-side JavaScript runs.
- Search requests continue to use `GET /api/public/sites?q=domain`.
- Public lookups are recorded separately from blocked-event records when a live database is configured.
- If `DATABASE_URL` is missing, the public catalog uses the bundled mirrored blocklist snapshot and only falls back to the built-in demo dataset if that mirror source is unavailable.

## Required environment variables for live mode

- `DATABASE_URL`: Postgres connection string.
- `ADMIN_USERNAME`: Username for the admin dashboard and private APIs.
- `ADMIN_PASSWORD`: Password for the admin dashboard and private APIs.
- `INGEST_SHARED_SECRET`: Shared secret required by `POST /api/ingest/securly`.
- `CRON_SECRET`: Secret used by Vercel Cron when calling `/api/cron/sync-securly`.
- `SECURLY_API_BASE_URL`: Base URL for the authorized Securly API.
- `SECURLY_API_TOKEN`: Bearer token or API key for the authorized Securly API.
- `SECURLY_API_BLOCK_EVENTS_PATH`: Optional path override for the block-events endpoint. Defaults to `/block-events`.
- `SECURLY_SYNC_LOOKBACK_MINUTES`: Optional lookback window for scheduled sync. Defaults to `30`.

## Database setup

- Run the SQL in `scripts/schema.sql` against your Postgres database.
- The schema creates `raw_block_events`, `domain_rollups`, `sync_runs`, `public_lookup_logs`, and `securly_mirrored_blocks`.
- To seed sample rows into Postgres, run `npm run seed:sample` with `DATABASE_URL` set.
- To mirror public GitHub-hosted blocklists into Postgres, run `npm run import:blocklists` with `DATABASE_URL` set.
- The public blocklist importer discovers all root `.txt` lists in `blocklistproject/Lists`, adds `sjhgvr/oisd` `oisd_big.txt`, normalizes domain rows, and upserts them into `securly_mirrored_blocks`.
- Use `node scripts/import-public-blocklists.js --dry-run` to fetch and parse the sources without writing to the database.

## DB-free mirrored catalog

- Run `npm run generate:mirror-snapshot` to rebuild the bundled mirrored snapshot used by the public site when no `DATABASE_URL` is configured.
- The snapshot is generated from the Blocklist Project root lists plus `sjhgvr/oisd` and is intentionally capped per source to keep deploys lightweight.
- At request time, the server may try a short best-effort refresh from GitHub, but the checked-in snapshot remains the reliable baseline so the public catalog is never empty just because external fetches fail.

## API notes

- Server-rendered homepage: `GET /`
- Public data: `GET /api/public/sites?q=domain`
- Private raw events: `GET /api/admin/events`
- Private lookup logs: `GET /api/admin/lookups`
- Private site detail: `GET /api/admin/sites/:domain`
- Manual ingest: `POST /api/ingest/securly`
- Scheduled sync: `GET /api/cron/sync-securly`

## Scheduling note

The included `vercel.json` uses a daily cron so the project can deploy on a Vercel Hobby account. For more frequent syncs, move the project to Pro or trigger the cron endpoint from an external scheduler.
