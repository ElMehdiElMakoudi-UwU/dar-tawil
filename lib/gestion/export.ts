import "server-only";
import { requireAdmin } from "./auth";
import { sql } from "./db";
import type { Sheet } from "./xlsx";

/*
 * Admin-only downloads: the year's books as a workbook for the accountant,
 * and a full JSON backup of the database. Headers are in French, the
 * accountant's language, whatever the screen language.
 */

const d = (v: string | null) => (v ? { date: v } : null);
const m = (v: number | null) => (v == null ? null : { money: v });

export async function yearWorkbook(year: number): Promise<Sheet[]> {
  await requireAdmin();
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;

  const [sales, payments, invoices, purchases, expenses, payroll, movements, counts, adjustments, products, customers] = await Promise.all([
    sql`
      select s.date, s.order_no, ro.order_no as return_of, c.name as customer, s.channel, p.sku, p.name as product,
             s.qty, s.unit, s.unit_price, s.discount_pct, s.qty * s.unit_price * (1 - s.discount_pct / 100) as total,
             s.qty * s.unit_cost as cogs, s.payment, s.paid, i.no as invoice, u.name as by
      from sales s join products p on p.id = s.product_id
      left join customers c on c.id = s.customer_id left join users u on u.id = s.created_by
      left join sales ro on ro.id = s.return_of left join invoices i on i.order_no = s.order_no
      where s.date between ${from} and ${to} order by s.date, s.order_no, s.id`,
    sql`
      select sp.date, sp.order_no, c.name as customer, sp.amount, sp.payment, u.name as by
      from sale_payments sp left join users u on u.id = sp.created_by
      left join lateral (select customer_id from sales where order_no = sp.order_no limit 1) s on true
      left join customers c on c.id = s.customer_id
      where sp.date between ${from} and ${to} order by sp.date, sp.id`,
    sql`
      select i.no, i.date, i.order_no, i.customer_name, i.customer_ice, i.customer_address,
             (select sum(qty * unit_price * (1 - discount_pct / 100)) from sales where order_no = i.order_no) as total
      from invoices i where i.year = ${year} order by i.seq`,
    sql`
      select pu.date, pu.supplier, p.sku, p.name as product, pu.qty, p.unit, pu.unit_cost, pu.qty * pu.unit_cost as total, pu.paid, pu.notes
      from purchases pu join products p on p.id = pu.product_id
      where pu.date between ${from} and ${to} order by pu.date, pu.id`,
    sql`select date, category, description, amount, payment, notes from expenses where date between ${from} and ${to} order by date, id`,
    sql`
      select p.date, p.period, e.name as employee, p.kind, p.amount, p.notes
      from payroll p join employees e on e.id = p.employee_id
      where p.date between ${from} and ${to} order by p.date, p.id`,
    sql`select date, account, direction, category, amount, notes from cash_movements where date between ${from} and ${to} order by date, id`,
    sql`select date, counted, notes from cash_counts where date between ${from} and ${to} order by date`,
    sql`
      select a.date, p.sku, p.name as product, a.qty, p.unit, a.reason, a.qty * a.unit_cost as value, a.notes, u.name as by
      from stock_adjustments a join products p on p.id = a.product_id left join users u on u.id = a.created_by
      where a.date between ${from} and ${to} order by a.date, a.id`,
    sql`
      select p.sku, p.name, p.category, p.unit, p.unit_cost, p.price, p.active,
             p.opening_stock + coalesce((select sum(qty) from purchases where product_id = p.id), 0)
               - coalesce((select sum(qty * factor) from sales where product_id = p.id), 0)
               + coalesce((select sum(qty) from stock_adjustments where product_id = p.id), 0) as stock
      from products p order by p.category nulls last, p.name`,
    sql`
      select c.name, c.phone, c.city, c.type, c.ice, c.address, c.notes,
             coalesce((select sum(qty * unit_price * (1 - discount_pct / 100)) from sales where customer_id = c.id), 0) as spent,
             coalesce((select sum(o.owed) from (
               select greatest(sum(s.qty * s.unit_price * (1 - s.discount_pct / 100))
                        - coalesce((select sum(amount) from sale_payments where order_no = s.order_no), 0), 0) as owed
               from sales s where s.customer_id = c.id and not s.paid group by s.order_no) o), 0) as owed
      from customers c order by c.name`,
  ]);

  return [
    {
      name: "Ventes",
      columns: ["Date", "N°", "Avoir sur", "Client", "Canal", "SKU", "Produit", "Qté", "Unité", "Prix unit.", "Remise %", "Total", "Coût", "Marge", "Paiement", "Payé", "Facture", "Vendeur"],
      rows: sales.map((r) => [
        d(r.date), r.order_no, r.return_of, r.customer, r.channel, r.sku, r.product, r.qty, r.unit, m(r.unit_price),
        r.discount_pct || null, m(r.total), m(r.cogs), m(r.total - r.cogs), r.payment, r.paid, r.invoice, r.by,
      ]),
    },
    {
      name: "Encaissements",
      columns: ["Date", "Vente", "Client", "Montant", "Paiement", "Saisi par"],
      rows: payments.map((r) => [d(r.date), r.order_no, r.customer, m(r.amount), r.payment, r.by]),
    },
    {
      name: "Factures",
      columns: ["N°", "Date", "Vente", "Client", "ICE", "Adresse", "Total TTC"],
      rows: invoices.map((r) => [r.no, d(r.date), r.order_no, r.customer_name, r.customer_ice, r.customer_address, m(r.total)]),
    },
    {
      name: "Achats",
      columns: ["Date", "Fournisseur", "SKU", "Produit", "Qté", "Unité", "Coût unit.", "Total", "Payé", "Notes"],
      rows: purchases.map((r) => [d(r.date), r.supplier, r.sku, r.product, r.qty, r.unit, m(r.unit_cost), m(r.total), r.paid, r.notes]),
    },
    {
      name: "Dépenses",
      columns: ["Date", "Catégorie", "Description", "Montant", "Paiement", "Notes"],
      rows: expenses.map((r) => [d(r.date), r.category, r.description, m(r.amount), r.payment, r.notes]),
    },
    {
      name: "Paie",
      columns: ["Date", "Mois", "Employé", "Type", "Montant", "Notes"],
      rows: payroll.map((r) => [d(r.date), r.period, r.employee, ({ salary: "Salaire", advance: "Avance", bonus: "Prime" } as Record<string, string>)[r.kind], m(r.amount), r.notes]),
    },
    {
      name: "Trésorerie",
      columns: ["Date", "Compte", "Sens", "Motif", "Montant", "Notes"],
      rows: movements.map((r) => [
        d(r.date), r.account === "cash" ? "Espèces" : "Banque", r.direction === "in" ? "Entrée" : "Sortie", r.category,
        m(r.direction === "in" ? r.amount : -r.amount), r.notes,
      ]),
    },
    {
      name: "Comptages caisse",
      columns: ["Date", "Compté", "Notes"],
      rows: counts.map((r) => [d(r.date), m(r.counted), r.notes]),
    },
    {
      name: "Pertes & inventaire",
      columns: ["Date", "SKU", "Produit", "Qté", "Unité", "Motif", "Valeur au coût", "Notes", "Saisi par"],
      rows: adjustments.map((r) => [
        d(r.date), r.sku, r.product, r.qty, r.unit,
        ({ waste: "Périmé / abîmé", damaged: "Cassé", sample: "Dégustation", own_use: "Usage interne", count: "Inventaire", other: "Autre" } as Record<string, string>)[r.reason],
        m(r.value), r.notes, r.by,
      ]),
    },
    {
      name: "Stock actuel",
      columns: ["SKU", "Produit", "Catégorie", "Unité", "Coût", "Prix", "En vente", "Stock", "Valeur au coût"],
      rows: products.map((r) => [r.sku, r.name, r.category, r.unit, m(r.unit_cost), m(r.price), r.active, r.stock, m(Math.max(r.stock, 0) * r.unit_cost)]),
    },
    {
      name: "Clients",
      columns: ["Nom", "Téléphone", "Ville", "Type", "ICE", "Adresse", "Notes", "Total dépensé", "Doit"],
      rows: customers.map((r) => [r.name, r.phone, r.city, r.type, r.ice, r.address, r.notes, m(r.spent), m(r.owed)]),
    },
  ];
}

/** Tables in an order that respects their foreign keys; sessions are left out. */
export const backupTables = [
  "users", "lists", "settings", "products", "customers", "employees",
  "orders", "order_lines", "sales", "sale_payments", "invoices",
  "purchases", "expenses", "payroll", "cash_movements", "cash_counts", "stock_adjustments",
] as const;
export const backupSequences = ["order_seq", "prep_order_seq", "return_seq"] as const;

/** Everything needed to rebuild the database with scripts/restore-backup.mjs. */
export async function fullBackup() {
  await requireAdmin();
  return sql.begin("isolation level repeatable read read only", async (tx) => {
    const tables: Record<string, readonly unknown[]> = {};
    for (const t of backupTables) tables[t] = await tx`select * from ${tx(t)} order by 1`;
    const sequences: Record<string, number> = {};
    for (const s of backupSequences) {
      const [r] = await tx<{ last_value: number; is_called: boolean }[]>`select last_value::int, is_called from ${tx(s)}`;
      sequences[s] = r.is_called ? r.last_value : 0;
    }
    const [{ name: migration }] = await tx<{ name: string }[]>`select max(name) as name from schema_migrations`;
    return { app: "dar-tawil", format: 1, migration, created_at: new Date().toISOString(), sequences, tables };
  });
}
