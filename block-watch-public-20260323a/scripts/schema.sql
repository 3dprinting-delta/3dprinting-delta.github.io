create table if not exists raw_block_events (
  id bigserial primary key,
  source_event_id text not null unique,
  source text not null,
  domain text not null,
  full_url text,
  blocked_at timestamptz not null,
  reason text not null,
  user_id text,
  device_id text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists raw_block_events_domain_idx on raw_block_events (domain);
create index if not exists raw_block_events_blocked_at_idx on raw_block_events (blocked_at desc);

create table if not exists domain_rollups (
  domain text primary key,
  display_name text not null,
  reason text not null,
  first_seen timestamptz not null,
  last_seen timestamptz not null,
  event_count integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists domain_rollups_last_seen_idx on domain_rollups (last_seen desc);

create table if not exists sync_runs (
  id bigserial primary key,
  source text not null,
  status text not null,
  imported_count integer not null default 0,
  failed_count integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  details jsonb not null default '{}'::jsonb
);

create index if not exists sync_runs_source_started_idx on sync_runs (source, started_at desc);

create table if not exists public_lookup_logs (
  id bigserial primary key,
  queried_domain text not null,
  normalized_domain text not null,
  matched_domain text,
  result_type text not null,
  searched_at timestamptz not null default now(),
  request_meta jsonb not null default '{}'::jsonb
);

create index if not exists public_lookup_logs_searched_at_idx on public_lookup_logs (searched_at desc);
create index if not exists public_lookup_logs_normalized_domain_idx on public_lookup_logs (normalized_domain);

create table if not exists securly_mirrored_blocks (
  domain text primary key,
  category text not null,
  discovered_at timestamptz not null default now()
);

create index if not exists securly_mirrored_blocks_category_idx on securly_mirrored_blocks (category);
create index if not exists securly_mirrored_blocks_discovered_at_idx on securly_mirrored_blocks (discovered_at desc);
