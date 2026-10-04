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
import { adjustReasons } from "@/lib/gestion/adjust";
import { businessKeys, orderStatuses } from "@/lib/gestion/queries";
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

/** The fields shared by "New sale" and "Edit sale". */
function saleFields(fd: FormData, t: Dict) {
  return {
    day: date(fd, "date", t.field.date),
    customerName: text(fd, "customer"),
    channel: text(fd, "channel"),
    payment: text(fd, "payment"),
    paid: checked(fd, "paid"),
    lines: parseLines(fd),
  };
}

async function customerId(tx: TransactionSql<any>, name: string | null) {
  if (!name) return null;
  const [c] = await tx<{ id: number }[]>`
    insert into customers (name) values (${name})
    on conflict (name) do update set name = excluded.name returning id
  `;
  return c.id;
}

/** Hands the sale number back too, so the till can print its receipt. */
export async function createSale(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  let orderNo: string | undefined;
  const result = await handle(async (t) => {
    const f = saleFields(fd, t);
    orderNo = await sql.begin(async (tx) =>
      insertSale(tx, { ...f, customerId: await customerId(tx, f.customerName), userId: user.id }),
    );
    refresh();
    return fill(t.ok.orderSaved, { no: orderNo });
  });
  return result?.ok && orderNo ? { ...result, ref: orderNo } : result;
}

/**
 * Rewrites a sale in place, under the same number. Admins can correct any
 * sale; staff only their own, on the day they made it. A sale that was
 * invoiced, has returns, or came from an order is changed another way.
 */
export async function updateSale(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const no = text(fd, "order_no", { required: true })!;
  const result = await handle(async (t) => {
    const f = saleFields(fd, t);
    await sql.begin(async (tx) => {
      const lines = await tx<{ id: number; date: string; created_by: number | null; return_of: number | null; product_id: number }[]>`
        select id, date, created_by, return_of, product_id from sales where order_no = ${no} for update
      `;
      if (!lines.length) throw new InputError("missing");
      if (lines.some((l) => l.return_of)) throw new InputError("returnNoEdit");
      if (user.role !== "admin" && !lines.every((l) => l.created_by === user.id && l.date === today())) {
        throw new InputError("editOwnToday");
      }
      await assertChangeable(tx, no);
      const [order] = await tx<{ no: string }[]>`select no from orders where sale_no = ${no}`;
      if (order) throw new InputError("fromOrder", { no: order.no });

      const [{ received }] = await tx<{ received: number }[]>`
        select coalesce(sum(amount), 0) as received from sale_payments where order_no = ${no}
      `;
      if (received > linesTotal(f.lines) + 0.005) throw new InputError("receivedOverTotal", { amount: received.toFixed(2) });

      // Same number and author; costs are the products' current ones, as when an order is edited.
      await tx`delete from sales where order_no = ${no}`;
      await insertSale(tx, {
        ...f, no, customerId: await customerId(tx, f.customerName), userId: lines[0].created_by ?? user.id,
        keepArchived: lines.map((l) => l.product_id),
      });
    });
    refresh();
  });
  if (result?.error) return result;
  redirect(`/gestion/sales/${encodeURIComponent(no)}`);
}

/** An invoice can't change once issued: a mistake on it is fixed with a credit note. */
async function assertNotInvoiced(tx: TransactionSql<any>, no: string) {
  const [inv] = await tx<{ no: string }[]>`select no from invoices where order_no = ${no}`;
  if (inv) throw new InputError("invoiced", { no: inv.no });
}

/** Rewriting a sale would also drop the returns made against it. */
async function assertChangeable(tx: TransactionSql<any>, no: string) {
  await assertNotInvoiced(tx, no);
  const [ret] = await tx<{ no: string }[]>`
    select r.order_no as no from sales r join sales s on s.id = r.return_of where s.order_no = ${no} limit 1
  `;
  if (ret) throw new InputError("hasReturns", { no: ret.no });
}

/** Staff can mark an order paid; only admins can flip it back to unpaid. */
export async function setOrderPaid(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  return handle(async (t) => {
    const orderNo = text(fd, "order_no", { required: true })!;
    const paid = fd.get("paid") === "true";
    if (!paid && user.role !== "admin") throw new InputError("unpaidAdmin");
    await sql.begin(async (tx) => {
      if (paid) await settleRest(tx, orderNo, user.id);
      await tx`update sales set paid = ${paid} where order_no = ${orderNo}`;
      // A sale made from a delivered order: keep the order in step.
      await tx`update orders set paid = ${paid} where sale_no = ${orderNo}`;
    });
    refresh();
  });
}

/**
 * Settling a sale that was partly paid, or paid on a later day: what was
 * left is recorded as a payment today, so the till sees the money the day it
 * came in. A sale paid in full on its own day needs no payment line.
 */
async function settleRest(tx: TransactionSql<any>, orderNo: string, userId: number) {
  await tx`
    insert into sale_payments (order_no, date, amount, payment, created_by)
    select ${orderNo}, ${today()}, x.total - x.received, x.payment, ${userId}
    from (
      select sum(s.qty * s.unit_price * (1 - s.discount_pct / 100)) as total, min(s.payment) as payment, min(s.date) as day,
             bool_and(s.paid) as paid,
             (select coalesce(sum(amount), 0) from sale_payments where order_no = ${orderNo}) as received,
             exists (select 1 from sale_payments where order_no = ${orderNo}) as has_payments
      from sales s where s.order_no = ${orderNo}
    ) x
    where not x.paid and (x.has_payments or x.day < ${today()}) and x.total - x.received > 0.005
  `;
}

export async function deleteSale(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return handle(async (t) => {
    await sql.begin(async (tx) => {
      const [line] = await tx<{ order_no: string }[]>`select order_no from sales where id = ${id(fd)} for update`;
      if (!line) throw new InputError("missing");
      await assertNotInvoiced(tx, line.order_no);
      // Returns made on this line go with it, unless one was invoiced.
      const [inv] = await tx<{ no: string }[]>`
        select i.no from invoices i join sales r on r.order_no = i.order_no where r.return_of = ${id(fd)} limit 1
      `;
      if (inv) throw new InputError("invoiced", { no: inv.no });
      const [s] = await tx<{ order_no: string }[]>`delete from sales where id = ${id(fd)} returning order_no`;
      // Its last line gone: so is the money received on it.
      if (s) await tx`delete from sale_payments where order_no = ${s.order_no} and not exists (select 1 from sales where order_no = ${s.order_no})`;
    });
    refresh();
    return t.ok.deleted;
  });
}

/* ── returns, payments on account, invoices ───────────────────────── */

/**
 * Gives back part or all of a paid sale as a credit note (R00001): negative
 * lines at the price and cost they were sold at, so revenue, profit and stock
 * all go back. Items not fit to sell again are written off as damaged.
 * qty_<line id> fields carry how much of each line comes back.
 */
export async function createReturn(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAdmin();
  const no = text(fd, "order_no", { required: true })!;
  let returnNo = "";
  const result = await handle(async (t) => {
    const day = date(fd, "date", t.field.date);
    const payment = text(fd, "payment");
    const restock = checked(fd, "restock");
    await sql.begin(async (tx) => {
      const lines = await tx<{
        id: number; product_id: number; qty: number; unit: string; factor: number; unit_cost: number;
        paid: boolean; return_of: number | null; returned: number;
      }[]>`
        select s.id, s.product_id, s.qty, s.unit, s.factor, s.unit_cost, s.paid, s.return_of,
               coalesce((select -sum(r.qty) from sales r where r.return_of = s.id), 0) as returned
        from sales s where s.order_no = ${no} order by s.id for update
      `;
      if (!lines.length) throw new InputError("missing");
      if (lines.some((l) => l.return_of)) throw new InputError("returnOfReturn");
      if (!lines.every((l) => l.paid)) throw new InputError("returnUnpaid");

      const back = lines
        .map((l) => ({ ...l, back: number(fd, `qty_${l.id}`, { min: 0, label: t.field.quantity }) ?? 0 }))
        .filter((l) => l.back > 0);
      if (!back.length) throw new InputError("returnNothing");
      for (const l of back) {
        if (l.back > l.qty - l.returned + 0.0005) throw new InputError("returnTooMuch", { qty: l.qty - l.returned });
      }

      returnNo = (await tx<{ no: string }[]>`select 'R' || lpad(nextval('return_seq')::text, 5, '0') as no`)[0].no;
      for (const l of back) {
        const [r] = await tx<{ id: number }[]>`
          insert into sales (date, order_no, customer_id, channel, product_id, qty, unit, factor, unit_price,
                             discount_pct, unit_cost, payment, paid, created_by, return_of)
          select ${day}, ${returnNo}, customer_id, channel, product_id, ${-l.back}, unit, factor, unit_price,
                 discount_pct, unit_cost, coalesce(${payment}, payment), true, ${user.id}, id
          from sales where id = ${l.id}
          returning id
        `;
        if (!restock) {
          await tx`
            insert into stock_adjustments (date, product_id, qty, reason, unit_cost, notes, sale_id, created_by)
            values (${day}, ${l.product_id}, ${-l.back * l.factor}, 'damaged', ${l.unit_cost / l.factor},
                    ${fill(t.adjust.fromReturn, { no: returnNo })}, ${r.id}, ${user.id})
          `;
        }
      }
    });
    refresh();
  });
  if (result?.error) return result;
  redirect(`/gestion/sales/${returnNo}`);
}

/**
 * Money received on what a customer owes: on one sale (order_no), or on a
 * customer's account (customer_id), spread over their oldest sales first.
 * A sale whose balance reaches zero is marked paid.
 */
export async function receivePayment(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  return handle(async (t) => {
    const day = date(fd, "date", t.field.date);
    const amount = number(fd, "amount", { required: true, min: 0.01, label: t.field.amount })!;
    const payment = text(fd, "payment");
    const orderNo = text(fd, "order_no");
    const custId = orderNo ? null : id(fd, "customer_id");

    const settled = await sql.begin(async (tx) => {
      const where = orderNo ? tx`s.order_no = ${orderNo}` : tx`s.customer_id = ${custId}`;
      // Locks the sales so two payments at once can't both take the same balance.
      await tx`select 1 from sales s where ${where} and not s.paid for update`;
      const owed = await tx<{ order_no: string; owed: number }[]>`
        select s.order_no,
               sum(s.qty * s.unit_price * (1 - s.discount_pct / 100))
                 - coalesce((select sum(amount) from sale_payments sp where sp.order_no = s.order_no), 0) as owed
        from sales s where ${where} and not s.paid
        group by s.order_no order by min(s.date), s.order_no
      `;
      const total = owed.reduce((sum, o) => sum + Math.max(o.owed, 0), 0);
      if (total <= 0.005) throw new InputError("nothingOwed");
      if (amount > total + 0.005) throw new InputError("overOwed", { owed: total.toFixed(2) });

      let left = amount;
      const settled: string[] = [];
      for (const o of owed) {
        if (left <= 0.005) break;
        if (o.owed <= 0.005) continue;
        const part = Math.min(left, o.owed);
        await tx`
          insert into sale_payments (order_no, date, amount, payment, created_by)
          values (${o.order_no}, ${day}, ${Math.round(part * 100) / 100}, ${payment}, ${user.id})
        `;
        left -= part;
        if (part >= o.owed - 0.005) settled.push(o.order_no);
      }
      if (settled.length) {
        await tx`update sales set paid = true where order_no in ${tx(settled)}`;
        await tx`update orders set paid = true where sale_no in ${tx(settled)}`;
      }
      return settled.length;
    });
    refresh();
    return settled ? fill(t.ok.paymentSettled, { n: settled }) : t.ok.paymentSaved;
  });
}

/**
 * Issues the invoice for a sale or credit note, numbered F-2026-0001 with no
 * gaps in the year. Once issued it can't be deleted or changed: corrections
 * go through a credit note. The customer's ICE and address are saved on
 * their record too, for next time.
 */
export async function issueInvoice(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  return handle(async (t) => {
    const no = text(fd, "order_no", { required: true })!;
    const day = date(fd, "date", t.field.date);
    const name = text(fd, "customer_name", { required: true, label: t.field.customer })!;
    const ice = text(fd, "customer_ice");
    if (ice && !/^\d{15}$/.test(ice.replace(/\s/g, ""))) throw new InputError("badIce");
    const address = text(fd, "customer_address");

    const invoiceNo = await sql.begin(async (tx) => {
      // One writer at a time, so two invoices never take the same number.
      await tx`lock table invoices in share row exclusive mode`;
      const [sale] = await tx<{ customer_id: number | null }[]>`select min(customer_id) as customer_id from sales where order_no = ${no} having count(*) > 0`;
      if (!sale) throw new InputError("missing");
      const [existing] = await tx<{ no: string }[]>`select no from invoices where order_no = ${no}`;
      if (existing) throw new InputError("invoiced", { no: existing.no });
      const year = Number(day.slice(0, 4));
      const [{ seq, last }] = await tx<{ seq: number; last: string | null }[]>`
        select coalesce(max(seq), 0) + 1 as seq, max(date) as last from invoices where year = ${year}
      `;
      // Numbers follow dates: an invoice can't be dated before the last one.
      if (last && day < last) throw new InputError("invoiceDate", { date: last });
      const invoiceNo = `F-${year}-${String(seq).padStart(4, "0")}`;
      await tx`
        insert into invoices (no, year, seq, order_no, date, customer_name, customer_ice, customer_address, created_by)
        values (${invoiceNo}, ${year}, ${seq}, ${no}, ${day}, ${name}, ${ice?.replace(/\s/g, "") ?? null}, ${address}, ${user.id})
      `;
      if (sale.customer_id) {
        await tx`
          update customers set ice = coalesce(${ice?.replace(/\s/g, "") ?? null}, ice), address = coalesce(${address}, address)
          where id = ${sale.customer_id}
        `;
      }
      return invoiceNo;
    });
    refresh();
    return fill(t.ok.invoiceIssued, { no: invoiceNo });
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
        await assertChangeable(tx, o.sale_no);
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
    insert into sale_payments (order_no, order_id, date, amount, payment, created_by)
    select ${saleNo}, id, (created_at at time zone 'Africa/Casablanca')::date, deposit, payment, ${userId}
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
        await assertChangeable(tx, saleNo);
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
  const user = await requireUser();
  return handle(async () => {
    const orderId = id(fd);
    await sql.begin(async (tx) => {
      const [o] = await tx<{ sale_no: string | null }[]>`update orders set paid = true where id = ${orderId} returning sale_no`;
      if (o?.sale_no) {
        await settleRest(tx, o.sale_no, user.id);
        await tx`update sales set paid = true where order_no = ${o.sale_no}`;
      }
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

/* ── stock adjustments ────────────────────────────────────────────── */

/**
 * Stock that leaves without a sale (waste, breakage, samples, own use),
 * or a correction after counting the shelf: for "count", qty is what was
 * counted and the difference is recorded. Staff can record them; only
 * admins see their value or remove them.
 */
export async function createAdjustment(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  return handle(async (t) => {
    const reason = oneOf(fd, "reason", adjustReasons, t.field.reason);
    const productId = id(fd, "product_id");
    const day = date(fd, "date", t.field.date);
    const notes = text(fd, "notes");
    const entered = number(fd, "qty", { required: true, min: reason === "other" ? undefined : 0, label: t.field.quantity })!;

    const moved = await sql.begin(async (tx) => {
      const [p] = await tx<{ stock: number; unit_cost: number; unit: string }[]>`
        select p.unit_cost, p.unit,
               p.opening_stock
                 + coalesce((select sum(qty) from purchases where product_id = p.id), 0)
                 - coalesce((select sum(qty * factor) from sales where product_id = p.id), 0)
                 + coalesce((select sum(qty) from stock_adjustments where product_id = p.id), 0) as stock
        from products p where p.id = ${productId} for update
      `;
      if (!p) throw new InputError("productGone");
      const qty = reason === "count" ? Math.round((entered - p.stock) * 1000) / 1000 : reason === "other" ? entered : -entered;
      if (qty === 0) return null;
      await tx`
        insert into stock_adjustments (date, product_id, qty, reason, unit_cost, notes, created_by)
        values (${day}, ${productId}, ${qty}, ${reason}, ${p.unit_cost}, ${notes}, ${user.id})
      `;
      return { qty, unit: p.unit };
    });
    if (!moved) {
      if (reason === "count") return t.ok.countMatches;
      throw new InputError("qtyNotZero");
    }
    refresh();
    return fill(t.ok.adjusted, { qty: `${moved.qty > 0 ? "+" : ""}${moved.qty}`, unit: moved.unit });
  });
}

/** A write-off from a return goes with the return, not on its own. */
export async function deleteAdjustment(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return handle(async (t) => {
    const del = await sql`delete from stock_adjustments where id = ${id(fd)} and sale_id is null`;
    if (del.count !== 1) throw new InputError("adjustFromReturn");
    refresh();
    return t.ok.deleted;
  });
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
      ice: text(fd, "ice"),
      address: text(fd, "address"),
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

/** The house's legal details for receipts and invoices. */
export async function saveBusiness(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return handle(async (t) => {
    const vat = number(fd, "vat_rate", { min: 0, label: t.field.vatRate }) ?? 0;
    if (vat >= 100) throw new InputError("min", { label: t.field.vatRate, min: 0 });
    const rows = businessKeys.map((key) => ({
      key,
      value: key === "vat_rate" ? String(vat) : String(fd.get(key) ?? "").trim(),
    }));
    await sql`
      insert into settings ${sql(rows)}
      on conflict (key) do update set value = excluded.value
    `;
    refresh();
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
