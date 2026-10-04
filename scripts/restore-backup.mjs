// Loads a backup downloaded from /gestion (Export & backup) into a database.
//   node scripts/restore-backup.mjs dar-tawil-backup-….json
//   node scripts/restore-backup.mjs dar-tawil-backup-….json --replace   (overwrites existing data)
// Run migrations first (npm run migrate) so the tables exist. Without
// --replace it refuses if the database already holds users, products or
// sales, so it can't overwrite live books by mistake.
import { readFile } from "node:fs/promises";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
const replace = process.argv.includes("--replace");
if (!url || !file) {
  console.error("Usage: DATABASE_URL=… node scripts/restore-backup.mjs <backup.json> [--replace]");
  process.exit(1);
}

const backup = JSON.parse(await readFile(file, "utf8"));
if (backup.app !== "dar-tawil" || backup.format !== 1) {
  console.error("Not a Dar Tawil backup file.");
  process.exit(1);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });
// Same order as lib/gestion/export.ts: parents before children.
const tables = Object.keys(backup.tables);

try {
  const [{ name: migration }] = await sql`select max(name) as name from schema_migrations`;
  if (migration !== backup.migration) {
    throw new Error(`The database is at ${migration}, the backup at ${backup.migration}. Run the same version of the app (npm run migrate) first.`);
  }
  await sql.begin(async (tx) => {
    const [{ n }] = await tx`select (select count(*) from users) + (select count(*) from products) + (select count(*) from sales) as n`;
    if (Number(n) > 0 && !replace) {
      throw new Error("The database already has data. Re-run with --replace to overwrite it.");
    }
    await tx.unsafe(`truncate sessions, ${tables.join(", ")} restart identity cascade`);
    for (const t of tables) {
      const rows = backup.tables[t];
      if (!rows.length) continue;
      // json_populate_recordset casts each field to its column's type.
      await tx.unsafe(`insert into ${t} select * from json_populate_recordset(null::${t}, $1::text::json)`, [JSON.stringify(rows)]);
      // Serial ids carry on after the restored ones.
      const [{ seq }] = await tx`
        select pg_get_serial_sequence(table_name, column_name) as seq from information_schema.columns
        where table_schema = current_schema() and table_name = ${t} and column_name = 'id'
        union all select null limit 1
      `;
      if (seq) await tx.unsafe(`select setval('${seq}', (select coalesce(max(id), 0) + 1 from ${t}), false)`);
      console.log(`${t}: ${rows.length}`);
    }
    for (const [s, value] of Object.entries(backup.sequences)) {
      await tx.unsafe(value > 0 ? `select setval('${s}', ${Number(value)}, true)` : `select setval('${s}', 1, false)`);
    }
  });
  console.log(`restored backup of ${backup.created_at}`);
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
