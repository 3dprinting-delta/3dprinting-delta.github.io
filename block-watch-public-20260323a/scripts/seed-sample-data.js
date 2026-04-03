const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
  });

  await client.connect();
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await client.query(schema);

  const now = Date.now();
  const samples = [
    ["evt-1001", "youtube.com", "https://youtube.com/watch?v=abc", new Date(now - 8 * 3600e3).toISOString(), "Streaming media"],
    ["evt-1002", "discord.com", "https://discord.com/channels/demo", new Date(now - 6 * 3600e3).toISOString(), "Chat and social platform"],
    ["evt-1003", "reddit.com", "https://reddit.com/r/science", new Date(now - 90 * 60e3).toISOString(), "Forums and social content"]
  ];

  for (const sample of samples) {
    await client.query(
      `
        insert into raw_block_events (
          source_event_id, source, domain, full_url, blocked_at, reason, raw_payload
        )
        values ($1, 'securly-api', $2, $3, $4, $5, $6::jsonb)
        on conflict (source_event_id) do nothing
      `,
      [sample[0], sample[1], sample[2], sample[3], sample[4], JSON.stringify({ seeded: true })]
    );

    await client.query(
      `
        insert into domain_rollups (
          domain, display_name, reason, first_seen, last_seen, event_count, updated_at
        )
        values ($1, initcap(split_part($1, '.', 1)), $2, $3, $3, 1, now())
        on conflict (domain) do update
        set reason = excluded.reason,
            first_seen = least(domain_rollups.first_seen, excluded.first_seen),
            last_seen = greatest(domain_rollups.last_seen, excluded.last_seen),
            event_count = domain_rollups.event_count + 1,
            updated_at = now()
      `,
      [sample[1], sample[4], sample[3]]
    );
  }

  await client.end();
  console.log("Sample data seeded.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
