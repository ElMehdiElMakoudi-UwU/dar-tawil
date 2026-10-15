// Applies db/migrations/*.sql in order, once each. Runs before the server
// starts in the container, and by hand with `npm run migrate`.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");
const sql = postgres(url, { max: 1, onnotice: () => {} });

// The app container can come up while Postgres is still starting (a server
// reboot, or both redeployed together). Wait for it instead of crashing.
const TRANSIENT = new Set(["57P03", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "CONNECT_TIMEOUT"]);
for (let attempt = 1; ; attempt++) {
  try {
    await sql`select 1`;
    break;
  } catch (err) {
    if (!TRANSIENT.has(err.code) || attempt >= 30) throw err;
    console.log(`database not ready (${err.code}), retrying in 2s (${attempt}/30)`);
    await new Promise((r) => setTimeout(r, 2000));
  }
}

try {
  await sql`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
  const applied = new Set((await sql`select name from schema_migrations`).map((r) => r.name));
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const body = await readFile(path.join(dir, file), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into schema_migrations (name) values (${file})`;
    });
    console.log(`applied ${file}`);
  }
  console.log("migrations up to date");
} finally {
  await sql.end();
}
