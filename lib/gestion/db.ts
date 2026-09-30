import "server-only";
import postgres from "postgres";

/**
 * One pool for the whole server. Kept on globalThis in dev so hot reloads
 * don't open a new pool each time.
 *
 * numeric comes back as a JS number (amounts here are far below float
 * precision limits) and date as its "YYYY-MM-DD" string, so nothing
 * downstream has to think about time zones.
 */
function connect() {
  return postgres(process.env.DATABASE_URL ?? "", {
    max: 10,
    onnotice: () => {},
    transform: { undefined: null },
    types: {
      numeric: {
        to: 1700,
        from: [1700],
        serialize: (x: number) => String(x),
        parse: (x: string) => Number(x),
      },
      date: {
        to: 1082,
        from: [1082],
        serialize: (x: string) => x,
        parse: (x: string) => x,
      },
    },
  });
}

const globalForDb = globalThis as unknown as { __dtSql?: ReturnType<typeof connect> };

export const sql = globalForDb.__dtSql ?? connect();
if (process.env.NODE_ENV !== "production") globalForDb.__dtSql = sql;
