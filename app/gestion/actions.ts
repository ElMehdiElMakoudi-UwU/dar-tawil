"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSession, destroySession, endAllSessions, requireAdmin, requireUser } from "@/lib/gestion/auth";
import { sql } from "@/lib/gestion/db";
import { checked, date, handle, id, InputError, number, oneOf, text, type FormState } from "@/lib/gestion/form";
import { fill, isLang, type Dict } from "@/lib/gestion/i18n";
import { getT, LANG_COOKIE } from "@/lib/gestion/lang";

/*
 * Every action re-checks the role itself: server actions are public HTTP
 * endpoints, whatever the page that renders the form does.
 */

const refresh = () => revalidatePath("/gestion", "layout");

/* ── language ───────────────────────────────────────────────────────── */

/** Open to signed-out visitors too: the sign-in page has the switch. */
export async function setLang(fd: FormData) {
  const lang = fd.get("lang");
  if (!isLang(lang)) return;
  (await cookies()).set(LANG_COOKIE, lang, { path: "/gestion", maxAge: 365 * 86_400, sameSite: "lax" });
  refresh();
}

/* ── sign in / out ────────────────────────────────────────────────── */

// Small in-memory brake on password guessing: 8 failures per email or IP
// per 15 minutes. Resets when the server restarts, which is fine for one box.
const failures = new Map<string, { count: number; until: number }>();
const WINDOW = 15 * 60_000;

function blocked(key: string) {
  const f = failures.get(key);
  return !!f && f.until > Date.now() && f.count >= 8;
}
function fail(key: string) {
  const f = failures.get(key);
  if (!f || f.until < Date.now()) failures.set(key, { count: 1, until: Date.now() + WINDOW });
  else f.count++;
}

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  const keys = [`e:${email}`, `i:${ip}`];

  const t = await getT();
  if (keys.some(blocked)) return { error: t.err.tooMany, at: Date.now() };

  const [user] = await sql<{ id: number; password_hash: string }[]>`
    select id, password_hash from users where email = ${email} and active
  `;
  // Compare against a dummy hash when the email is unknown so timing doesn't tell.
  const ok = await bcrypt.compare(password, user?.password_hash ?? "$2b$12$8dLVHjwtwF0WsE/d8ZZibe.KMag76OTIX29JR4K43yrlszAurqMiS");
  if (!user || !ok) {
    keys.forEach(fail);
    return { error: t.err.wrongLogin, at: Date.now() };
  }
  keys.forEach((k) => failures.delete(k));
  await createSession(user.id);
  redirect("/gestion");
}

export async function logout() {
  await destroySession();
  redirect("/gestion/login");
}

/** Creates the very first admin. Refuses once any user exists. */
export async function setup(_: FormState, fd: FormData): Promise<FormState> {
  const result = await handle(async (t) => {
    const name = text(fd, "name", { required: true, label: t.field.name })!;
    const email = text(fd, "email", { required: true, label: t.field.email })!.toLowerCase();
    const password = passwordField(fd);
    const hash = await bcrypt.hash(password, 12);
    const created = await sql.begin(async (tx) => {
      await tx`lock table users in exclusive mode`;
      const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from users`;
      if (n > 0) return null;
      const [u] = await tx<{ id: number }[]>`
        insert into users (name, email, password_hash, role) values (${name}, ${email}, ${hash}, 'admin') returning id
      `;
      return u.id;
    });
    if (!created) throw new InputError("setupDone");
    await createSession(created);
  });
  if (result?.error) return result;
  redirect("/gestion");
}

function passwordField(fd: FormData, key = "password") {
  const p = String(fd.get(key) ?? "");
  if (p.length < 8) throw new InputError("password8");
  return p;
}

/* ── sales ────────────────────────────────────────────────────────── */

/** alt: sold in the product's second unit (e.g. by the piece) instead of its stock unit. */
type Line = { productId: number; qty: number; unitPrice: number; discount: number; alt?: boolean };

export async function createSale(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  return handle(async (t) => {
    const day = date(fd, "date", t.field.date);
    const customerName = text(fd, "customer");
    const channel = text(fd, "channel");
    const payment = text(fd, "payment");
    const paid = checked(fd, "paid");

    let lines: Line[];
    try {
      lines = JSON.parse(String(fd.get("lines") ?? "[]"));
    } catch {
      throw new InputError("readProducts");
    }
    lines = lines.filter((l) => l && l.productId);
    if (!lines.length) throw new InputError("addProduct");
    for (const l of lines) {
      if (!Number.isInteger(l.productId)) throw new InputError("pickProduct");
      if (!(l.qty > 0)) throw new InputError("qtyPositive");
      if (!(l.unitPrice >= 0)) throw new InputError("priceNegative");
      if (!(l.discount >= 0 && l.discount <= 100)) throw new InputError("discountRange");
    }

    const orderNo = await sql.begin(async (tx) => {
      let customerId: number | null = null;
      if (customerName) {
        const [c] = await tx<{ id: number }[]>`
          insert into customers (name) values (${customerName})
          on conflict (name) do update set name = excluded.name returning id
        `;
        customerId = c.id;
      }
      const [{ no }] = await tx<{ no: string }[]>`select 'O' || lpad(nextval('order_seq')::text, 5, '0') as no`;
      for (const l of lines) {
        // Unit, factor and unit_cost come from the product server-side; staff
        // never send or see the cost. unit_cost is per unit sold.
        const alt = l.alt === true;
        const inserted = await tx`
          insert into sales (date, order_no, customer_id, channel, product_id, qty, unit, factor, unit_price, discount_pct, unit_cost, payment, paid, created_by)
          select ${day}, ${no}, ${customerId}, ${channel}, p.id, ${l.qty}, u.unit, u.factor, ${l.unitPrice}, ${l.discount},
                 round(p.unit_cost * u.factor, 4), ${payment}, ${paid}, ${user.id}
          from products p
          cross join lateral (
            select case when ${alt} then p.alt_unit else p.unit end as unit,
                   case when ${alt} then p.alt_factor else 1 end as factor
          ) u
          where p.id = ${l.productId} and p.active and u.unit is not null
        `;
        if (inserted.count !== 1) {
          throw new InputError(alt ? "altGone" : "productGone");
        }
      }
      return no;
    });
    refresh();
    return fill(t.ok.orderSaved, { no: orderNo });
  });
}

/** Staff can mark an order paid; only admins can flip it back to unpaid. */
export async function setOrderPaid(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  return handle(async (t) => {
    const orderNo = text(fd, "order_no", { required: true })!;
    const paid = fd.get("paid") === "true";
    if (!paid && user.role !== "admin") throw new InputError("unpaidAdmin");
    await sql`update sales set paid = ${paid} where order_no = ${orderNo}`;
    refresh();
  });
}

export async function deleteSale(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return handle(async (t) => {
    await sql`delete from sales where id = ${id(fd)}`;
    refresh();
    return t.ok.deleted;
  });
}

/* ── products ─────────────────────────────────────────────────────── */

export async function saveProduct(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const result = await handle(async (t) => {
    const productId = Number(fd.get("id")) || null;
    const values = {
      sku: text(fd, "sku", { required: true, label: t.field.sku })!.toUpperCase(),
      name: text(fd, "name", { required: true, label: t.field.name })!,
      category: text(fd, "category"),
      unit: text(fd, "unit") ?? "U",
      unit_cost: number(fd, "unit_cost", { min: 0, label: t.field.unitCost }) ?? 0,
      price: number(fd, "price", { required: true, min: 0, label: t.field.sellingPrice })!,
      opening_stock: number(fd, "opening_stock", { label: t.field.openingStock }) ?? 0,
      reorder_level: number(fd, "reorder_level", { min: 0, label: t.field.reorderLevel }) ?? 0,
      active: productId ? checked(fd, "active") : true,
      ...altUnit(fd, t),
    };
    if (productId) {
      await sql`update products set ${sql(values)} where id = ${productId}`;
    } else {
      await sql`insert into products ${sql(values)}`;
    }
    refresh();
  });
  return result;
}

/** The optional second selling unit: all three fields, or none. */
function altUnit(fd: FormData, t: Dict) {
  const alt_unit = text(fd, "alt_unit");
  const alt_factor = number(fd, "alt_factor", { label: t.field.altFactor });
  const alt_price = number(fd, "alt_price", { min: 0, label: t.field.altPrice });
  if (!alt_unit && alt_factor == null && alt_price == null) return { alt_unit: null, alt_factor: null, alt_price: null };
  if (!alt_unit || alt_factor == null || alt_price == null) {
    throw new InputError("altIncomplete");
  }
  if (!(alt_factor > 0)) throw new InputError("altFactor");
  return { alt_unit, alt_factor, alt_price };
}

/* ── customers ────────────────────────────────────────────────────── */

export async function saveCustomer(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  return handle(async (t) => {
    const customerId = Number(fd.get("id")) || null;
    if (customerId && user.role !== "admin") throw new InputError("editCustomerAdmin");
    const values = {
      name: text(fd, "name", { required: true, label: t.field.name })!,
      phone: text(fd, "phone"),
      city: text(fd, "city"),
      type: text(fd, "type"),
      notes: text(fd, "notes"),
    };
    if (customerId) await sql`update customers set ${sql(values)} where id = ${customerId}`;
    else await sql`insert into customers ${sql(values)}`;
    refresh();
  });
}

export async function deleteCustomer(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return handle(async (t) => {
    // Their sales stay; they just lose the customer name.
    await sql`delete from customers where id = ${id(fd)}`;
    refresh();
    return t.ok.deleted;
  });
}

/* ── purchases ────────────────────────────────────────────────────── */

export async function createPurchase(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAdmin();
  return handle(async (t) => {
    const values = {
      date: date(fd, "date", t.field.date),
      supplier: text(fd, "supplier"),
      product_id: id(fd, "product_id"),
      qty: number(fd, "qty", { required: true, min: 0.01, label: t.field.quantity })!,
      unit_cost: number(fd, "unit_cost", { required: true, min: 0, label: t.field.unitCost })!,
      paid: checked(fd, "paid"),
      notes: text(fd, "notes"),
      created_by: user.id,
    };
    await sql`insert into purchases ${sql(values)}`;
    if (checked(fd, "update_cost")) {
      await sql`update products set unit_cost = ${values.unit_cost} where id = ${values.product_id}`;
    }
    refresh();
  });
}

export async function setPurchasePaid(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return handle(async (t) => {
    await sql`update purchases set paid = ${fd.get("paid") === "true"} where id = ${id(fd)}`;
    refresh();
  });
}

export async function deletePurchase(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return handle(async (t) => {
    await sql`delete from purchases where id = ${id(fd)}`;
    refresh();
    return t.ok.deleted;
  });
}

/* ── expenses ─────────────────────────────────────────────────────── */

export async function createExpense(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAdmin();
  return handle(async (t) => {
    const values = {
      date: date(fd, "date", t.field.date),
      category: text(fd, "category", { required: true, label: t.field.category })!,
      description: text(fd, "description"),
      amount: number(fd, "amount", { required: true, min: 0, label: t.field.amount })!,
      payment: text(fd, "payment"),
      notes: text(fd, "notes"),
      created_by: user.id,
    };
    await sql`insert into expenses ${sql(values)}`;
    refresh();
  });
}

export async function deleteExpense(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return handle(async (t) => {
    await sql`delete from expenses where id = ${id(fd)}`;
    refresh();
    return t.ok.deleted;
  });
}

/* ── staff & payroll ──────────────────────────────────────────────── */

export async function saveEmployee(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return handle(async (t) => {
    const employeeId = Number(fd.get("id")) || null;
    const startDate = String(fd.get("start_date") ?? "");
    const values = {
      name: text(fd, "name", { required: true, label: t.field.name })!,
      position: text(fd, "position"),
      phone: text(fd, "phone"),
      monthly_salary: number(fd, "monthly_salary", { min: 0, label: t.field.monthlySalary }) ?? 0,
      start_date: startDate ? date(fd, "start_date", t.field.startDate) : null,
      notes: text(fd, "notes"),
      active: employeeId ? checked(fd, "active") : true,
    };
    if (employeeId) await sql`update employees set ${sql(values)} where id = ${employeeId}`;
    else await sql`insert into employees ${sql(values)}`;
    refresh();
  });
}

export async function createPayment(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAdmin();
  return handle(async (t) => {
    const period = String(fd.get("period") ?? "");
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new InputError("period");
    const values = {
      employee_id: id(fd, "employee_id"),
      date: date(fd, "date", t.field.date),
      period,
      kind: oneOf(fd, "kind", ["salary", "advance", "bonus"] as const, t.field.paymentType),
      amount: number(fd, "amount", { required: true, min: 0, label: t.field.amount })!,
      notes: text(fd, "notes"),
      created_by: user.id,
    };
    await sql`insert into payroll ${sql(values)}`;
    refresh();
  });
}

export async function deletePayment(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return handle(async (t) => {
    await sql`delete from payroll where id = ${id(fd)}`;
    refresh();
    return t.ok.deleted;
  });
}

/* ── cash & bank ──────────────────────────────────────────────────── */

export async function createMovement(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAdmin();
  return handle(async (t) => {
    const values = {
      date: date(fd, "date", t.field.date),
      account: oneOf(fd, "account", ["cash", "bank"] as const, t.field.account),
      direction: oneOf(fd, "direction", ["in", "out"] as const, t.field.direction),
      category: text(fd, "category", { required: true, label: t.field.category })!,
      amount: number(fd, "amount", { required: true, min: 0.01, label: t.field.amount })!,
      notes: text(fd, "notes"),
      created_by: user.id,
    };
    await sql`insert into cash_movements ${sql(values)}`;
    refresh();
  });
}

export async function deleteMovement(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return handle(async (t) => {
    await sql`delete from cash_movements where id = ${id(fd)}`;
    refresh();
    return t.ok.deleted;
  });
}

export async function saveCount(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAdmin();
  return handle(async (t) => {
    const day = date(fd, "date", t.field.date);
    const counted = number(fd, "counted", { required: true, min: 0, label: t.field.counted })!;
    const notes = text(fd, "notes");
    await sql`
      insert into cash_counts (date, counted, notes, created_by) values (${day}, ${counted}, ${notes}, ${user.id})
      on conflict (date) do update set counted = excluded.counted, notes = excluded.notes
    `;
    refresh();
  });
}

/* ── settings: lists & users ──────────────────────────────────────── */

export async function addListItem(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return handle(async (t) => {
    const kind = oneOf(fd, "kind", ["channel", "payment", "expense_category", "product_category", "customer_type"] as const, t.field.list);
    const value = text(fd, "value", { required: true, label: t.field.option })!;
    await sql`
      insert into lists (kind, value, position)
      values (${kind}, ${value}, (select coalesce(max(position), 0) + 1 from lists where kind = ${kind}))
    `;
    refresh();
    return t.ok.added;
  });
}

export async function deleteListItem(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return handle(async (t) => {
    await sql`delete from lists where id = ${id(fd)}`;
    refresh();
    return t.ok.removed;
  });
}

export async function createUser(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return handle(async (t) => {
    const name = text(fd, "name", { required: true, label: t.field.name })!;
    const email = text(fd, "email", { required: true, label: t.field.email })!.toLowerCase();
    const role = oneOf(fd, "role", ["admin", "staff"] as const, t.field.role);
    const hash = await bcrypt.hash(passwordField(fd), 12);
    await sql`insert into users (name, email, password_hash, role) values (${name}, ${email}, ${hash}, ${role})`;
    refresh();
    return fill(t.ok.userCreated, { name });
  });
}

export async function updateUser(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requireAdmin();
  return handle(async (t) => {
    const userId = id(fd);
    const role = oneOf(fd, "role", ["admin", "staff"] as const, t.field.role);
    const active = checked(fd, "active");
    if (userId === me.id && (role !== "admin" || !active)) {
      throw new InputError("ownAdmin");
    }
    await sql`update users set role = ${role}, active = ${active} where id = ${userId}`;
    if (!active) await endAllSessions(userId);
    const newPassword = String(fd.get("password") ?? "");
    if (newPassword) {
      await sql`update users set password_hash = ${await bcrypt.hash(passwordField(fd), 12)} where id = ${userId}`;
      if (userId !== me.id) await endAllSessions(userId);
    }
    refresh();
  });
}
