"use server";

import bcrypt from "bcryptjs";
import type { TransactionSql } from "postgres";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSession, destroySession, endAllSessions, requireAdmin, requireUser } from "@/lib/gestion/auth";
import { sql } from "@/lib/gestion/db";
import { checked, date, handle, id, InputError, number, oneOf, text, type FormState } from "@/lib/gestion/form";
import { fill, isLang, type Dict } from "@/lib/gestion/i18n";
import { today } from "@/lib/gestion/format";
import { getT, LANG_COOKIE } from "@/lib/gestion/lang";
import { orderStatuses } from "@/lib/gestion/queries";
import { insertSale, linesTotal, parseLines } from "@/lib/gestion/sale-lines";

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

export async function createSale(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  return handle(async (t) => {
    const day = date(fd, "date", t.field.date);
    const customerName = text(fd, "customer");
    const channel = text(fd, "channel");
    const payment = text(fd, "payment");
    const paid = checked(fd, "paid");
    const lines = parseLines(fd);

    const orderNo = await sql.begin(async (tx) => {
      let customerId: number | null = null;
      if (customerName) {
        const [c] = await tx<{ id: number }[]>`
          insert into customers (name) values (${customerName})
          on conflict (name) do update set name = excluded.name returning id
        `;
        customerId = c.id;
      }
      return insertSale(tx, { day, customerId, channel, payment, paid, userId: user.id, lines });
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
    await sql.begin(async (tx) => {
      await tx`update sales set paid = ${paid} where order_no = ${orderNo}`;
      // A sale made from a delivered order: keep the order in step.
      await tx`update orders set paid = ${paid} where sale_no = ${orderNo}`;
    });
    refresh();
  });
}

export async function deleteSale(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return handle(async (t) => {
    await sql.begin(async (tx) => {
      const [s] = await tx<{ order_no: string }[]>`delete from sales where id = ${id(fd)} returning order_no`;
      // Its last line gone: so is the money received on it.
      if (s) await tx`delete from sale_payments where order_no = ${s.order_no} and not exists (select 1 from sales where order_no = ${s.order_no})`;
    });
    refresh();
    return t.ok.deleted;
  });
}

/* ── orders to prepare ────────────────────────────────────────────── */

/**
 * Staff take and edit orders; the customer is added to Customers on the way,
 * like a sale. Editing an order that was already delivered rewrites its sale.
 */
export async function saveOrder(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const result = await handle(async (t) => {
    const orderId = Number(fd.get("id")) || null;
    const customerName = text(fd, "customer", { required: true, label: t.field.customer })!;
    const phone = text(fd, "phone");
    const city = text(fd, "city");
    const dueTime = text(fd, "due_time");
    if (dueTime && !/^\d{2}:\d{2}$/.test(dueTime)) throw new InputError("badTime");
    const lines = parseLines(fd);
    const deposit = number(fd, "deposit", { min: 0, label: t.field.deposit }) ?? 0;
    const total = linesTotal(lines);
    if (deposit > total + 0.005) throw new InputError("depositOverTotal");
    const values = {
      customer_name: customerName,
      phone,
      channel: text(fd, "channel"),
      fulfilment: oneOf(fd, "fulfilment", ["delivery", "pickup"] as const, t.field.fulfilment),
      due_date: date(fd, "due_date", t.field.dueDate),
      due_time: dueTime,
      address: text(fd, "address"),
      city,
      items: text(fd, "items"),
      notes: text(fd, "notes"),
      deposit,
      payment: text(fd, "payment"),
      // A deposit of the whole amount is a full payment.
      paid: checked(fd, "paid") || (total > 0 && deposit >= total - 0.005),
    };

    await sql.begin(async (tx) => {
      // Fills in a known customer's missing phone or city, never overwrites them.
      const [c] = await tx<{ id: number }[]>`
        insert into customers (name, phone, city) values (${customerName}, ${phone}, ${city})
        on conflict (name) do update set phone = coalesce(customers.phone, excluded.phone),
                                         city = coalesce(customers.city, excluded.city)
        returning id
      `;
      const row = { ...values, customer_id: c.id };
      let id = orderId;
      if (id) {
        const updated = await tx`update orders set ${tx(row)} where id = ${id}`;
        if (updated.count !== 1) throw new InputError("missing");
        await tx`delete from order_lines where order_id = ${id}`;
      } else {
        [{ id }] = await tx<{ id: number }[]>`insert into orders ${tx({ ...row, created_by: user.id })} returning id`;
      }
      await tx`
        insert into order_lines ${tx(
          lines.map((l, i) => ({
            order_id: id,
            product_id: l.productId,
            qty: l.qty,
            alt: l.alt === true,
            unit_price: l.unitPrice,
            discount_pct: l.discount,
            position: i,
          })),
        )}
      `;
      const [o] = await tx<{ sale_no: string | null }[]>`select sale_no from orders where id = ${id}`;
      if (o.sale_no) {
        // Same sale number and date; current product costs.
        const [{ day }] = await tx<{ day: string | null }[]>`select min(date) as day from sales where order_no = ${o.sale_no}`;
        await tx`delete from sales where order_no = ${o.sale_no}`;
        await insertSale(tx, {
          no: o.sale_no, day: day ?? today(), customerId: c.id, channel: values.channel,
          payment: values.payment, paid: values.paid, userId: user.id, lines,
        });
        await syncDeposit(tx, id!, o.sale_no, user.id);
      }
    });
    refresh();
  });
  if (result?.error) return result;
  redirect("/gestion/orders");
}

/**
 * The order's deposit, as a payment received on its sale on the day the
 * order was taken. Replaces the one copied before, if the order was edited.
 */
async function syncDeposit(tx: TransactionSql<any>, orderId: number, saleNo: string, userId: number) {
  await tx`delete from sale_payments where order_no = ${saleNo} and order_id = ${orderId}`;
  await tx`
    insert into sale_payments (order_no, order_id, date, amount, created_by)
    select ${saleNo}, id, (created_at at time zone 'Africa/Casablanca')::date, deposit, ${userId}
    from orders where id = ${orderId} and deposit > 0
  `;
}

/**
 * Moving an order to "delivered" records it as a sale, dated today, with the
 * order's lines and prices; moving it out of "delivered" removes that sale.
 */
export async function setOrderStatus(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  return handle(async (t) => {
    const status = oneOf(fd, "status", orderStatuses, t.field.status);
    const orderId = id(fd);
    await sql.begin(async (tx) => {
      const [o] = await tx<{
        status: string; sale_no: string | null; customer_id: number | null;
        channel: string | null; payment: string | null; paid: boolean;
      }[]>`select status, sale_no, customer_id, channel, payment, paid from orders where id = ${orderId} for update`;
      if (!o) throw new InputError("missing");
      if (o.status === status) return;

      let saleNo = o.sale_no;
      if (status === "delivered" && !saleNo) {
        const lines = await tx<{ productId: number; qty: number; alt: boolean; unitPrice: number; discount: number }[]>`
          select product_id as "productId", qty, alt, unit_price as "unitPrice", discount_pct as discount
          from order_lines where order_id = ${orderId} order by position, id
        `;
        if (!lines.length) throw new InputError("orderNoLines");
        saleNo = await insertSale(tx, {
          day: today(), customerId: o.customer_id, channel: o.channel,
          payment: o.payment, paid: o.paid, userId: user.id, lines,
        });
        await syncDeposit(tx, orderId, saleNo, user.id);
      } else if (status !== "delivered" && saleNo) {
        await tx`delete from sales where order_no = ${saleNo}`;
        await tx`delete from sale_payments where order_no = ${saleNo}`;
        saleNo = null;
      }
      await tx`update orders set status = ${status}, status_at = now(), sale_no = ${saleNo} where id = ${orderId}`;
    });
    refresh();
  });
}

export async function markOrderPaid(_: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  return handle(async () => {
    const orderId = id(fd);
    await sql.begin(async (tx) => {
      const [o] = await tx<{ sale_no: string | null }[]>`update orders set paid = true where id = ${orderId} returning sale_no`;
      if (o?.sale_no) await tx`update sales set paid = true where order_no = ${o.sale_no}`;
    });
    refresh();
  });
}

/** Its sale, if delivered, stays: that money really came in. */
export async function deleteOrder(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return handle(async (t) => {
    await sql`delete from orders where id = ${id(fd)}`;
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
