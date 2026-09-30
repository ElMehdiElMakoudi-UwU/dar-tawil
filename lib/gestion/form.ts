import "server-only";
import { fill, type Dict, type ErrKey } from "./i18n";
import { getT } from "./lang";

/** What every form action returns to <ActionForm>. */
export type FormState = { error?: string; ok?: string; at?: number } | undefined;

/** A message for the form, as a key into the dictionary's `err` section; translated in handle(). */
export class InputError extends Error {
  constructor(
    public key: ErrKey,
    public vars: Record<string, string | number> = {},
  ) {
    super(key);
  }
}

/* `label` is the field's name as the error should print it — callers pass t.field.*. */

export function text(fd: FormData, key: string, { required = false, label = key } = {}) {
  const v = String(fd.get(key) ?? "").trim();
  if (required && !v) throw new InputError("required", { label });
  return v || null;
}

export function number(fd: FormData, key: string, { required = false, min, label = key }: { required?: boolean; min?: number; label?: string } = {}) {
  const raw = String(fd.get(key) ?? "").trim().replace(",", ".");
  if (!raw) {
    if (required) throw new InputError("required", { label });
    return null;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new InputError("notNumber", { label });
  if (min != null && n < min) throw new InputError("min", { label, min });
  return n;
}

export function date(fd: FormData, key: string, label: string) {
  const v = String(fd.get(key) ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) throw new InputError("badDate", { label });
  return v;
}

export function oneOf<T extends string>(fd: FormData, key: string, options: readonly T[], label = key): T {
  const v = String(fd.get(key) ?? "");
  if (!options.includes(v as T)) throw new InputError("choose", { label });
  return v as T;
}

export const checked = (fd: FormData, key: string) => fd.get(key) === "on";

export function id(fd: FormData, key = "id") {
  const n = Number(fd.get(key));
  if (!Number.isInteger(n) || n <= 0) throw new InputError("missing");
  return n;
}

/**
 * Wraps an action body: input errors and unique-constraint clashes become a
 * message on the form; anything else (including Next's redirect) propagates.
 * The body gets the dictionary for field labels and its success message.
 */
export async function handle(run: (t: Dict) => Promise<string | void>): Promise<FormState> {
  const t = await getT();
  try {
    const ok = await run(t);
    return { ok: ok || t.ok.saved, at: Date.now() };
  } catch (e) {
    if (e instanceof InputError) return { error: fill(t.err[e.key], e.vars), at: Date.now() };
    if (typeof e === "object" && e && "code" in e && e.code === "23505") {
      return { error: t.err.exists, at: Date.now() };
    }
    throw e;
  }
}
