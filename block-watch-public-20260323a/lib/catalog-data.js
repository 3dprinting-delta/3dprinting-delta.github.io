const {
  getPublicSites,
  getMirroredPublicSites,
  getPublicStats,
  getMirroredPublicStats,
  getLatestSyncStatus,
} = require("./repository");
const { getMirroredCatalog } = require("./mirror-source");

function isMissingTableError(error) {
  return error && error.code === "42P01";
}

function mergePublicSites(primarySites, mirroredSites) {
  const seen = new Set();
  const merged = [];

  for (const site of primarySites) {
    seen.add(site.domain);
    merged.push(site);
  }

  for (const site of mirroredSites) {
    if (seen.has(site.domain)) {
      continue;
    }

    merged.push(site);
  }

  return merged.sort((left, right) => {
    const leftTime = new Date(left.lastSeen || left.firstSeen || 0).getTime();
    const rightTime = new Date(right.lastSeen || right.firstSeen || 0).getTime();
    if (leftTime !== rightTime) {
      return rightTime - leftTime;
    }

    return left.domain.localeCompare(right.domain);
  });
}

function combineStats(primaryStats, mirroredStats, primarySites, mirroredSites) {
  const primaryDomains = new Set(primarySites.map((site) => site.domain));
  const mirroredOnlyCount = mirroredSites.reduce((count, site) => count + (primaryDomains.has(site.domain) ? 0 : 1), 0);
  const primaryLastSeen = primaryStats?.lastSeen ? new Date(primaryStats.lastSeen).getTime() : 0;
  const mirroredLastSeen = mirroredStats?.lastSeen ? new Date(mirroredStats.lastSeen).getTime() : 0;
  const lastSeen =
    primaryLastSeen || mirroredLastSeen ? new Date(Math.max(primaryLastSeen, mirroredLastSeen)).toISOString() : null;

  return {
    blockedSiteCount: (primaryStats?.blockedSiteCount || 0) + mirroredOnlyCount,
    eventCount: (primaryStats?.eventCount || 0) + mirroredOnlyCount,
    lastSeen,
  };
}

async function getCatalogPayload(search = "") {
  let mirrorPayload = null;

  try {
    const [sites, mirroredSites, stats, mirroredStats, syncStatus] = await Promise.all([
      getPublicSites(search),
      getMirroredPublicSites(search).catch((error) => {
        if (isMissingTableError(error)) {
          return [];
        }

        throw error;
      }),
      getPublicStats(),
      getMirroredPublicStats().catch((error) => {
        if (isMissingTableError(error)) {
          return { blockedSiteCount: 0, eventCount: 0, lastSeen: null };
        }

        throw error;
      }),
      getLatestSyncStatus(),
    ]);
    const hasDbMirrorData = (mirroredStats?.blockedSiteCount || 0) > 0 || mirroredSites.length > 0;
    mirrorPayload = hasDbMirrorData ? null : await getMirroredCatalog(search).catch(() => null);
    const mirrorSites = mirrorPayload?.sites || [];
    const mirrorStats = mirrorPayload?.stats || { blockedSiteCount: 0, eventCount: 0, lastSeen: null };

    const mergedSites = mergePublicSites(sites, [...mirroredSites, ...mirrorSites]);
    const combinedStats = combineStats(
      stats,
      {
        blockedSiteCount:
          (mirroredStats?.blockedSiteCount || 0) + (mirrorStats.blockedSiteCount || 0),
        eventCount: (mirroredStats?.eventCount || 0) + (mirrorStats.eventCount || 0),
        lastSeen:
          [mirroredStats?.lastSeen, mirrorStats.lastSeen].filter(Boolean).sort().pop() || null,
      },
      sites,
      [...mirroredSites, ...mirrorSites]
    );

    return {
      sites: mergedSites,
      stats: {
        blockedSiteCount: combinedStats.blockedSiteCount || 0,
        eventCount: combinedStats.eventCount || 0,
        lastSeen: combinedStats.lastSeen || null,
      },
      syncStatus: syncStatus
        ? {
            source: syncStatus.source,
            status: syncStatus.status,
            importedCount: syncStatus.importedCount,
            failedCount: syncStatus.failedCount,
            startedAt: syncStatus.startedAt,
            completedAt: syncStatus.completedAt,
          }
        : mirrorPayload?.syncStatus || null,
      dataSource: "live",
    };
  } catch (error) {
    if (error.message === "DATABASE_URL is not configured.") {
      mirrorPayload = await getMirroredCatalog(search).catch(() => null);
      if (mirrorPayload) {
        return mirrorPayload;
      }

      return {
        sites: [],
        stats: {
          blockedSiteCount: 0,
          eventCount: 0,
          lastSeen: null,
        },
        syncStatus: {
          source: "mirror-snapshot",
          status: "mirror_unavailable",
          importedCount: 0,
          failedCount: 0,
          startedAt: null,
          completedAt: null,
        },
        dataSource: "mirror",
      };
    }

    throw error;
  }
}

module.exports = {
  getCatalogPayload,
};
