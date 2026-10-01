import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "./db";

export type Role = "admin" | "staff";
export type User = { id: number; name: string; email: string; role: Role };

const COOKIE = "dt_session";
const SESSION_DAYS = 30;

/**
 * Secure only when the request really came over HTTPS (Coolify's proxy sets
 * x-forwarded-proto). A Secure cookie sent over plain http is dropped by the
 * browser, which looks like being logged out on every click.
 */
async function isHttps() {
  const proto = (await headers()).get("x-forwarded-proto")?.split(",")[0].trim();
  return proto === "https";
}

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** The signed-in user for this request, or null. Deduplicated per render. */
export const getUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [user] = await sql<User[]>`
    select u.id, u.name, u.email, u.role
    from sessions s join users u on u.id = s.user_id
    where s.id = ${hash(token)} and s.expires_at > now() and u.active
  `;
  return user ?? null;
});

/**
 * Every page and every server action in /gestion calls one of these two.
 * Layouts alone are not enough: they don't re-run on client navigation, and
 * server actions can be called directly.
 */
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/gestion/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/gestion");
  return user;
}

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await sql`insert into sessions (id, user_id, expires_at) values (${hash(token)}, ${userId}, ${expires})`;
  await sql`delete from sessions where expires_at < now()`;
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: await isHttps(),
    sameSite: "lax",
    path: "/gestion",
    expires,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await sql`delete from sessions where id = ${hash(token)}`;
  jar.delete({ name: COOKIE, path: "/gestion" });
}

/** Signs a user out everywhere, e.g. after a password reset or deactivation. */
export async function endAllSessions(userId: number) {
  await sql`delete from sessions where user_id = ${userId}`;
}
