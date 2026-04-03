const now = Date.now();

const demoSites = [
  ["youtube.com", "YouTube", "Streaming media", 8, 95, 14],
  ["discord.com", "Discord", "Chat and social platform", 6, 50, 11],
  ["reddit.com", "Reddit", "Forums and social content", 3, 12, 7],
  ["spotify.com", "Spotify", "Audio streaming", 12, 180, 9],
  ["twitch.tv", "Twitch", "Live streaming", 18, 240, 6],
  ["coolmathgames.com", "Coolmath Games", "Games", 21, 420, 5],
  ["roblox.com", "Roblox", "Games and virtual worlds", 26, 320, 10],
  ["netflix.com", "Netflix", "Streaming media", 30, 510, 4],
  ["pinterest.com", "Pinterest", "Social media and image sharing", 36, 610, 3],
  ["twitter.com", "Twitter", "Social media", 42, 730, 8],
  ["facebook.com", "Facebook", "Social media", 48, 870, 12],
  ["instagram.com", "Instagram", "Social media", 54, 960, 13],
].map(([domain, displayName, reason, firstSeenHoursAgo, lastSeenMinutesAgo, eventCount]) => ({
  domain,
  displayName,
  reason,
  firstSeen: new Date(now - firstSeenHoursAgo * 60 * 60 * 1000).toISOString(),
  lastSeen: new Date(now - lastSeenMinutesAgo * 60 * 1000).toISOString(),
  eventCount,
}));

function searchDemoSites(query) {
  const search = String(query || "").trim().toLowerCase();
  if (!search) {
    return demoSites;
  }

  return demoSites.filter((site) => {
    return (
      site.domain.toLowerCase().includes(search) ||
      site.displayName.toLowerCase().includes(search) ||
      site.reason.toLowerCase().includes(search)
    );
  });
}

function getDemoStats() {
  return {
    blockedSiteCount: demoSites.length,
    eventCount: demoSites.reduce((sum, site) => sum + site.eventCount, 0),
    lastSeen: demoSites.reduce((latest, site) => {
      return !latest || new Date(site.lastSeen) > new Date(latest) ? site.lastSeen : latest;
    }, null),
  };
}

module.exports = {
  demoSites,
  searchDemoSites,
  getDemoStats,
};
