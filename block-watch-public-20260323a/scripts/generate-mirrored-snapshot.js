const fs = require("fs");
const path = require("path");
const {
  SNAPSHOT_PATH,
  SNAPSHOT_MAX_ROWS_PER_SOURCE,
  buildMirroredDataset,
} = require("../lib/mirror-source");

async function main() {
  const snapshot = await buildMirroredDataset({
    maxRowsPerSource: SNAPSHOT_MAX_ROWS_PER_SOURCE,
    timeoutMs: 5000,
  });

  fs.mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true });
  fs.writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

  console.log(`Wrote mirrored snapshot to ${SNAPSHOT_PATH}`);
  console.log(`Generated ${snapshot.stats.blockedSiteCount} visible sites from ${snapshot.sourceCount} sources.`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
