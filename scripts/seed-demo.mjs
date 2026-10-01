// Loads db/seed/demo.sql: demo products, customers, sales, orders, etc. for
// presenting the back office. Run by hand, never on start:
//   node scripts/seed-demo.mjs           refuses if there are products or sales already
//   node scripts/seed-demo.mjs --reset   wipes all business data first, then loads the demo
//   node scripts/seed-demo.mjs --wipe    wipes all business data and stops (before going live)
// User accounts and dropdown lists are always kept.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const reset = process.argv.includes("--reset");
const wipe = process.argv.includes("--wipe");
const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "db", "seed", "demo.sql");
const sql = postgres(url, { max: 1, onnotice: () => {} });

try {
  await sql.begin(async (tx) => {
    if (reset || wipe) {
      await tx.unsafe(`
        truncate sale_payments, order_lines, orders, sales, purchases, expenses,
                 payroll, employees, cash_movements, cash_counts, customers, products
                 restart identity cascade;
        alter sequence order_seq restart;
        alter sequence prep_order_seq restart;
      `);
      console.log("business data wiped (users and lists kept)");
    }
    if (!wipe) {
      await tx.unsafe(await readFile(file, "utf8"));
      const [c] = await tx`select (select count(*) from products) as products, (select count(distinct order_no) from sales) as sales,
                                  (select count(*) from orders) as orders`;
      console.log(`demo data loaded: ${c.products} products, ${c.sales} sales, ${c.orders} orders`);
    }
  });
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
