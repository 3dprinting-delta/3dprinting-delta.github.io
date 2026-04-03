const { query } = require("./db");
const { normalizeDomain, normalizeEvent, titleFromDomain } = require("./normalize");

function buildPublicSearchClause(search, columns) {
  if (!search) {
    return { whereClause: "", values: [] };
  }

  const value = `%${search.toLowerCase()}%`;
  const predicates = columns.map((column) => `lower(${column}) like $1`);
  return {
    whereClause: `where ${predicates.join(" or ")}`,
    values: [value],
  };
}

async function recordSyncStart(source, details = {}) {
  const result = await query(
    `
      insert into sync_runs (source, status, details)
      values ($1, 'running', $2::jsonb)
      returning id, source, status, started_at as "startedAt"
    `,
    [source, JSON.stringify(details)]
  );

  return result.rows[0];
}

async function recordSyncCompletion(id, status, importedCount, failedCount, details = {}) {
  await query(
    `
      update sync_runs
      set status = $2,
          imported_count = $3,
          failed_count = $4,
          completed_at = now(),
          details = coalesce(details, '{}'::jsonb) || $5::jsonb
      where id = $1
    `,
    [id, status, importedCount, failedCount, JSON.stringify(details)]
  );
}

async function upsertNormalizedEvents(events) {
  let importedCount = 0;
  let failedCount = 0;
  const failures = [];

  for (const candidate of events) {
    const normalized = normalizeEvent(candidate);
    if (!normalized.ok) {
      failedCount += 1;
      failures.push({ candidate, error: normalized.error });
      continue;
    }

    const event = normalized.value;
    const inserted = await query(
      `
        insert into raw_block_events (
          source_event_id, source, domain, full_url, blocked_at, reason, user_id, device_id, raw_payload
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
        on conflict (source_event_id) do nothing
        returning domain
      `,
      [
        event.sourceEventId,
        event.source,
        event.domain,
        event.fullUrl,
        event.blockedAt,
        event.reason,
        event.userId,
        event.deviceId,
        JSON.stringify(event.rawPayload),
      ]
    );

    if (!inserted.rowCount) {
      continue;
    }

    importedCount += 1;

    await query(
      `
        insert into domain_rollups (
          domain, display_name, reason, first_seen, last_seen, event_count, updated_at
        )
        values ($1, $2, $3, $4, $4, 1, now())
        on conflict (domain) do update
        set display_name = excluded.display_name,
            reason = excluded.reason,
            first_seen = least(domain_rollups.first_seen, excluded.first_seen),
            last_seen = greatest(domain_rollups.last_seen, excluded.last_seen),
            event_count = domain_rollups.event_count + 1,
            updated_at = now()
      `,
      [event.domain, event.displayName || titleFromDomain(event.domain), event.reason, event.blockedAt]
    );
  }

  return { importedCount, failedCount, failures };
}

async function getPublicSites(search) {
  const { whereClause, values } = buildPublicSearchClause(search, ["domain", "display_name", "reason"]);

  const result = await query(
    `
      select
        domain,
        display_name as "displayName",
        reason,
        first_seen as "firstSeen",
        last_seen as "lastSeen",
        event_count as "eventCount"
      from domain_rollups
      ${whereClause}
      order by last_seen desc
      limit 100
    `,
    values
  );

  return result.rows;
}

async function getMirroredPublicSites(search) {
  const { whereClause, values } = buildPublicSearchClause(search, ["domain", "category"]);

  const result = await query(
    `
      select
        domain,
        category,
        discovered_at as "discoveredAt"
      from securly_mirrored_blocks
      ${whereClause}
      order by discovered_at desc, domain asc
      limit 100
    `,
    values
  );

  return result.rows.map((row) => ({
    domain: row.domain,
    displayName: titleFromDomain(row.domain),
    reason: row.category,
    firstSeen: row.discoveredAt,
    lastSeen: row.discoveredAt,
    eventCount: 1,
  }));
}

async function getPublicStats() {
  const result = await query(
    `
      select
        count(*)::int as "blockedSiteCount",
        coalesce(sum(event_count), 0)::int as "eventCount",
        max(last_seen) as "lastSeen"
      from domain_rollups
    `
  );

  return result.rows[0];
}

async function getMirroredPublicStats() {
  const result = await query(
    `
      select
        count(*)::int as "blockedSiteCount",
        count(*)::int as "eventCount",
        max(discovered_at) as "lastSeen"
      from securly_mirrored_blocks
    `
  );

  return result.rows[0];
}

async function recordPublicLookup(queriedDomain, matchedDomain, resultType, requestMeta = {}) {
  const normalizedDomain = normalizeDomain(queriedDomain);
  if (!normalizedDomain) {
    return null;
  }

  const result = await query(
    `
      insert into public_lookup_logs (
        queried_domain, normalized_domain, matched_domain, result_type, request_meta
      )
      values ($1, $2, $3, $4, $5::jsonb)
      returning
        id,
        queried_domain as "queriedDomain",
        normalized_domain as "normalizedDomain",
        matched_domain as "matchedDomain",
        result_type as "resultType",
        searched_at as "searchedAt"
    `,
    [queriedDomain, normalizedDomain, matchedDomain || null, resultType, JSON.stringify(requestMeta)]
  );

  return result.rows[0];
}

async function getAdminEvents(limit = 100) {
  const result = await query(
    `
      select
        source_event_id as "sourceEventId",
        source,
        domain,
        full_url as "fullUrl",
        blocked_at as "blockedAt",
        reason,
        user_id as "userId",
        device_id as "deviceId",
        created_at as "createdAt"
      from raw_block_events
      order by blocked_at desc
      limit $1
    `,
    [limit]
  );

  return result.rows;
}

async function getAdminLookups(limit = 100) {
  const result = await query(
    `
      select
        queried_domain as "queriedDomain",
        normalized_domain as "normalizedDomain",
        matched_domain as "matchedDomain",
        result_type as "resultType",
        searched_at as "searchedAt"
      from public_lookup_logs
      order by searched_at desc
      limit $1
    `,
    [limit]
  );

  return result.rows;
}

async function getAdminSite(domain) {
  const [siteResult, eventResult] = await Promise.all([
    query(
      `
        select
          domain,
          display_name as "displayName",
          reason,
          first_seen as "firstSeen",
          last_seen as "lastSeen",
          event_count as "eventCount"
        from domain_rollups
        where domain = $1
      `,
      [domain]
    ),
    query(
      `
        select
          source_event_id as "sourceEventId",
          source,
          domain,
          full_url as "fullUrl",
          blocked_at as "blockedAt",
          reason,
          user_id as "userId",
          device_id as "deviceId"
        from raw_block_events
        where domain = $1
        order by blocked_at desc
        limit 100
      `,
      [domain]
    ),
  ]);

  return {
    site: siteResult.rows[0] || null,
    events: eventResult.rows,
  };
}

async function getLatestSyncStatus(source = "securly-api") {
  const result = await query(
    `
      select
        source,
        status,
        imported_count as "importedCount",
        failed_count as "failedCount",
        started_at as "startedAt",
        completed_at as "completedAt",
        details
      from sync_runs
      where source = $1
      order by started_at desc
      limit 1
    `,
    [source]
  );

  return result.rows[0] || null;
}

module.exports = {
  recordSyncStart,
  recordSyncCompletion,
  upsertNormalizedEvents,
  getPublicSites,
  getMirroredPublicSites,
  getPublicStats,
  getMirroredPublicStats,
  recordPublicLookup,
  getAdminEvents,
  getAdminLookups,
  getAdminSite,
  getLatestSyncStatus,
};
