"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/gestion/auth";
import { evaluate, gapReasons, type GapReason } from "@/lib/gestion/control";
import { getControlLines, posStock } from "@/lib/gestion/controls";
import { sql } from "@/lib/gestion/db";
import { checked, date, handle, id, InputError, number, text, type FormState } from "@/lib/gestion/form";
import { fill, type Dict } from "@/lib/gestion/i18n";
import { today } from "@/lib/gestion/format";
import { getT } from "@/lib/gestion/lang";

/*
 * Stock control is the owner's job: every action is admin only, and checks
 * it itself:
 * server actions are public endpoints whatever page renders the form.
 */

const refresh = () => revalidatePath("/gestion", "layout");

/** The JSON array sent in one form field, or an error on the form. */
function jsonArray(fd: FormData, key: string): Record<string, unknown>[] {
  try {
    const v = JSON.parse(String(fd.get(key) ?? "[]"));
    if (Array.isArray(v)) return v.filter((x) => x && typeof x === "object");
  } catch {}
  throw new InputError("readProducts");
}

const productId = (v: unknown) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new InputError("readProducts");
  return n;
};

/** A count typed in a box: "12,5" reads as 12.5; empty is null. */
function quantity(v: unknown, t: Dict) {
  const raw = String(v ?? "").trim().replace(",", ".");
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new InputError("notNumber", { label: t.field.quantity });
  if (n < 0) throw new InputError("min", { label: t.field.quantity, min: 0 });
  return Math.round(n * 1000) / 1000;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/* ── start ───────────────────────────────────────────────────────── */

/**
 * Opens a control with the start count of each chosen product. With
 * `align`, the POS stock is set to those counts first (a 'count' adjustment
 * per product that differs), so both stocks really start the same.
 */
export async function createControl(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAdmin();
  let newId = 0;
  const state = await handle(async (t) => {
    const startDate = date(fd, "start_date", t.field.date);
    const label = text(fd, "label") ?? fill(t.control.defaultLabel, { date: startDate });
    const align = checked(fd, "align");
    const lines = jsonArray(fd, "lines").map((r) => {
      const qty = quantity(r.qty, t);
      if (qty == null) throw new InputError("controlStartMissing");
      return { productId: productId(r.productId), qty };
    });
    if (!lines.length) throw new InputError("addProduct");
    const ids = [...new Set(lines.map((l) => l.productId))];
    if (ids.length !== lines.length) throw new InputError("readProducts");

    newId = await sql.begin(async (tx) => {
      const stock = await posStock(tx, ids);
      if (stock.size !== ids.length) throw new InputError("productGone");
      const [c] = await tx<{ id: number }[]>`
        insert into stock_controls (label, start_date, aligned, created_by)
        values (${label}, ${startDate}, ${align}, ${user.id}) returning id
      `;
      for (const l of lines) {
        const p = stock.get(l.productId)!;
        const diff = round3(l.qty - p.stock);
        if (align && diff !== 0) {
          await tx`
            insert into stock_adjustments (date, product_id, qty, reason, unit_cost, notes, control_id, created_by)
            values (${startDate}, ${l.productId}, ${diff}, 'count', ${p.unit_cost}, ${fill(t.control.adjStart, { label })}, ${c.id}, ${user.id})
          `;
        }
        await tx`
          insert into stock_control_lines (control_id, product_id, start_qty, system_start)
          values (${c.id}, ${l.productId}, ${l.qty}, ${align ? l.qty : p.stock})
        `;
      }
      return c.id;
    });
    refresh();
  });
  if (state?.error) return state;
  redirect(`/gestion/stock-control/${newId}`);
}

/* ── count ───────────────────────────────────────────────────────── */

/** The saved count and what it was measured against, so the sheet shows the gap. */
export type CountResult =
  | {
      ok: true; counted_at: string | null; system_now: number; system_at_count: number | null;
      unit_cost: number; price: number; tol_qty: number; tol_pct: number;
    }
  | { ok: false; error: string };

/**
 * Saves one product's count the moment it is typed, with the POS stock at
 * that instant, so sales made while the rest of the shelf is counted don't
 * read as a gap. An empty box clears the count.
 */
export async function saveCount(controlId: number, product: number, value: string): Promise<CountResult> {
  const user = await requireAdmin();
  const t = await getT();
  try {
    if (!Number.isInteger(controlId) || !Number.isInteger(product)) throw new InputError("missing");
    const qty = quantity(value, t);
    return await sql.begin(async (tx): Promise<CountResult> => {
      const [line] = await tx<{ status: string }[]>`
        select c.status from stock_control_lines l join stock_controls c on c.id = l.control_id
        where l.control_id = ${controlId} and l.product_id = ${product}
        for update of c
      `;
      if (!line) throw new InputError("missing");
      if (line.status !== "open") throw new InputError("controlClosed");
      const p = (await posStock(tx, [product])).get(product);
      if (!p) throw new InputError("productGone");
      const base = { ok: true as const, system_now: p.stock, unit_cost: p.unit_cost, price: p.price, tol_qty: p.tol_qty, tol_pct: p.tol_pct };
      if (qty == null) {
        await tx`
          update stock_control_lines
          set counted_qty = null, system_at_count = null, counted_at = null, counted_by = null,
              unit_cost = null, price = null, tol_qty = null, tol_pct = null
          where control_id = ${controlId} and product_id = ${product}
        `;
        return { ...base, counted_at: null, system_at_count: null };
      }
      const [row] = await tx<{ at: string }[]>`
        update stock_control_lines
        set counted_qty = ${qty}, system_at_count = ${p.stock}, counted_at = now(), counted_by = ${user.id},
            unit_cost = ${p.unit_cost}, price = ${p.price}, tol_qty = ${p.tol_qty}, tol_pct = ${p.tol_pct}
        where control_id = ${controlId} and product_id = ${product}
        returning to_char(counted_at at time zone 'Africa/Casablanca', 'HH24:MI') as at
      `;
      return { ...base, counted_at: row.at, system_at_count: p.stock };
    });
  } catch (e) {
    if (e instanceof InputError) return { ok: false, error: fill(t.err[e.key], e.vars) };
    throw e;
  }
}

/* ── review & close ──────────────────────────────────────────────── */

async function openControl(controlId: number) {
  const [c] = await sql<{ status: string }[]>`select status from stock_controls where id = ${controlId}`;
  if (!c) throw new InputError("missing");
  if (c.status !== "open") throw new InputError("controlClosed");
}

/**
 * What the owner found for each gap (`reviews` JSON: productId, reason,
 * note). With intent=close it then closes the control: every gap beyond
 * tolerance must have a reason, and with `apply` the gaps are booked as
 * adjustments so the POS stock matches the shelf again. A closed control
 * can no longer change.
 */
export async function reviewControl(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAdmin();
  return handle(async (t) => {
    const controlId = id(fd);
    await openControl(controlId);
    const reviews = jsonArray(fd, "reviews").map((r) => {
      const reason = r.reason ? String(r.reason) : null;
      if (reason && !gapReasons.includes(reason as GapReason)) throw new InputError("choose", { label: t.field.reason });
      const note = String(r.note ?? "").trim().slice(0, 500) || null;
      return { productId: productId(r.productId), reason: reason as GapReason | null, note };
    });
    await sql.begin(async (tx) => {
      for (const r of reviews) {
        await tx`
          update stock_control_lines set gap_reason = ${r.reason}, gap_note = ${r.note}
          where control_id = ${controlId} and product_id = ${r.productId}
        `;
      }
    });
    if (fd.get("intent") !== "close") {
      refresh();
      return t.ok.saved;
    }

    const lines = await getControlLines(controlId);
    const counted = lines.map((l) => ({ l, e: evaluate(l) })).filter((x) => x.e != null);
    if (!counted.length) throw new InputError("controlNothingCounted");
    const unexplained = counted.filter((x) => x.e!.flagged && !x.l.gap_reason);
    if (unexplained.length) throw new InputError("controlUnexplained", { n: unexplained.length });
    const apply = checked(fd, "apply");

    let booked = 0;
    await sql.begin(async (tx) => {
      const [c] = await tx<{ status: string; label: string }[]>`select status, label from stock_controls where id = ${controlId} for update`;
      if (c.status !== "open") throw new InputError("controlClosed");
      if (apply) {
        for (const { l, e } of counted) {
          if (e!.gap === 0) continue;
          const reason = l.gap_reason === "waste" && e!.gap < 0 ? "waste" : "count";
          const why = l.gap_reason ? t.control.reasons[l.gap_reason] : t.control.withinTolerance;
          await tx`
            insert into stock_adjustments (date, product_id, qty, reason, unit_cost, notes, control_id, created_by)
            values (${today()}, ${l.product_id}, ${e!.gap}, ${reason}, ${l.unit_cost},
                    ${fill(t.control.adjClose, { label: c.label, why })}, ${controlId}, ${user.id})
          `;
          booked++;
        }
      }
      await tx`
        update stock_controls set status = 'closed', closed_at = now(), closed_by = ${user.id}, corrected = ${apply}
        where id = ${controlId}
      `;
    });
    refresh();
    return apply ? fill(t.ok.controlClosedFixed, { n: booked }) : t.ok.controlClosed;
  });
}

/** Only an open control: it takes back the adjustments it made at the start. */
export async function deleteControl(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const state = await handle(async () => {
    const controlId = id(fd);
    await openControl(controlId);
    await sql`delete from stock_controls where id = ${controlId} and status = 'open'`;
    refresh();
  });
  if (state?.error) return state;
  redirect("/gestion/stock-control");
}

/* ── money collected ─────────────────────────────────────────────── */

/** The money the owner collected over the control, typed by hand; empty clears it. */
export async function saveCollected(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return handle(async (t) => {
    const controlId = id(fd);
    const amount = number(fd, "cash_collected", { min: 0, label: t.control.collected });
    const note = text(fd, "cash_note")?.slice(0, 500) ?? null;
    const [row] = await sql`
      update stock_controls set cash_collected = ${amount == null ? null : Math.round(amount * 100) / 100}, cash_note = ${note}
      where id = ${controlId} returning id
    `;
    if (!row) throw new InputError("missing");
    refresh();
    return t.ok.saved;
  });
}

/* ── tolerances ──────────────────────────────────────────────────── */

/** `tolerances` JSON: productId, qty (stock unit), pct (of the expected quantity). */
export async function saveTolerances(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return handle(async (t) => {
    const rows = jsonArray(fd, "tolerances").map((r) => {
      const qty = quantity(r.qty, t) ?? 0;
      const pct = quantity(r.pct, t) ?? 0;
      if (pct > 100) throw new InputError("controlPct");
      return { productId: productId(r.productId), qty, pct };
    });
    await sql.begin(async (tx) => {
      for (const r of rows) {
        await tx`update products set count_tolerance = ${r.qty}, count_tolerance_pct = ${r.pct} where id = ${r.productId}`;
      }
    });
    refresh();
  });
}
