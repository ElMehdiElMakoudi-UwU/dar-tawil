import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/gestion/auth";
import { dateLabel, mad, qty } from "@/lib/gestion/format";
import { getBusiness, getSale, type Business, type Sale } from "@/lib/gestion/queries";
import { amountInWords } from "@/lib/gestion/words";
import { PrintBar } from "./print-bar";
import "../../print.css";

/*
 * Receipts and invoices, outside the app chrome so they print clean.
 * Always in French, whatever the screen language: they go to customers and
 * to the accountant, and that is the language of Moroccan commercial papers.
 */

type Doc = "receipt" | "invoice";
const isDoc = (d: string): d is Doc => d === "receipt" || d === "invoice";

export async function generateMetadata({ params }: PageProps<"/gestion/print/[doc]/[no]">): Promise<Metadata> {
  const { doc, no } = await params;
  return { title: `${doc === "invoice" ? "Facture" : "Ticket"} ${decodeURIComponent(no)}` };
}

export default async function PrintPage({ params, searchParams }: PageProps<"/gestion/print/[doc]/[no]">) {
  await requireUser();
  const { doc, no } = await params;
  if (!isDoc(doc)) notFound();
  const [sale, business] = await Promise.all([getSale(decodeURIComponent(no)), getBusiness()]);
  if (!sale) notFound();
  if (doc === "invoice" && !sale.invoice) notFound();
  // The invoice a credit note corrects, to refer to it.
  const original = sale.return_of_no ? await getSale(sale.return_of_no) : null;
  const auto = (await searchParams).print === "1";

  return (
    <div className={`p-doc p-${doc}`} lang="fr" dir="ltr">
      <PrintBar auto={auto} />
      {doc === "receipt" ? (
        <Receipt sale={sale} b={business} />
      ) : (
        <Invoice sale={sale} b={business} correcting={original?.invoice?.no ?? null} />
      )}
    </div>
  );
}

const vatRate = (b: Business) => Number(b.vat_rate) || 0;
const time = (d: Date) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Casablanca", hour: "2-digit", minute: "2-digit" }).format(d);

function Receipt({ sale, b }: { sale: Sale; b: Business }) {
  const isReturn = !!sale.return_of_no;
  return (
    <article className="p-sheet">
      <header className="p-center">
        <p className="p-brand">{b.business_name || "Dar Tawil"}</p>
        {b.address && <p>{b.address}</p>}
        {b.city && <p>{b.city}</p>}
        {b.phone && <p>Tél. {b.phone}</p>}
        {b.ice && <p>ICE {b.ice}</p>}
      </header>
      <hr />
      <p className="p-center p-strong">
        {isReturn ? `AVOIR ${sale.no}` : `TICKET ${sale.no}`}
      </p>
      {isReturn && <p className="p-center">sur la vente {sale.return_of_no}</p>}
      <p className="p-row">
        <span>{dateLabel(sale.date, "fr")}</span>
        <span>{time(sale.created_at)}</span>
      </p>
      {sale.customer && <p>Client : {sale.customer}</p>}
      {sale.created_by && <p>Vendeur : {sale.created_by}</p>}
      <hr />
      <ul className="p-lines">
        {sale.lines.map((l) => (
          <li key={l.id}>
            <p>{l.product}</p>
            <p className="p-row">
              <span>
                {qty(Math.abs(l.qty))}
                {l.unit !== "U" && ` ${l.unit}`} × {mad(l.unit_price)}
                {l.discount_pct > 0 && ` −${qty(l.discount_pct)}%`}
              </span>
              <span>{mad(l.total)}</span>
            </p>
          </li>
        ))}
      </ul>
      <hr />
      <p className="p-row p-total">
        <span>{isReturn ? "REMBOURSÉ" : "TOTAL"}</span>
        <span>{mad(Math.abs(sale.total))} MAD</span>
      </p>
      {vatRate(b) > 0 && (
        <p className="p-row p-small">
          <span>dont TVA {qty(vatRate(b))} %</span>
          <span>{mad(Math.abs(sale.total) - Math.abs(sale.total) / (1 + vatRate(b) / 100))}</span>
        </p>
      )}
      {sale.payment && <p className="p-row"><span>Paiement</span><span>{sale.payment}</span></p>}
      {!isReturn && !sale.paid && (
        <>
          {sale.received > 0 && <p className="p-row"><span>Déjà réglé</span><span>{mad(sale.received)}</span></p>}
          <p className="p-row p-strong"><span>Reste à payer</span><span>{mad(sale.owed)}</span></p>
        </>
      )}
      <hr />
      {b.receipt_footer && <p className="p-center">{b.receipt_footer}</p>}
    </article>
  );
}

function Invoice({ sale, b, correcting }: { sale: Sale; b: Business; correcting: string | null }) {
  const inv = sale.invoice!;
  const isCredit = !!sale.return_of_no;
  const rate = vatRate(b);
  const ttc = Math.abs(sale.total);
  const ht = rate > 0 ? ttc / (1 + rate / 100) : ttc;
  const legal = [
    b.rc && `RC ${b.rc}`, b.if_no && `IF ${b.if_no}`, b.ice && `ICE ${b.ice}`,
    b.patente && `Patente ${b.patente}`, b.cnss && `CNSS ${b.cnss}`,
  ].filter(Boolean);

  return (
    <article className="p-sheet">
      <header className="p-head">
        <div>
          <p className="p-brand">{b.legal_name || b.business_name || "Dar Tawil"}</p>
          {b.legal_name && b.business_name && b.legal_name !== b.business_name && <p>{b.business_name}</p>}
          {b.address && <p>{b.address}</p>}
          {b.city && <p>{b.city}</p>}
          {b.phone && <p>Tél. {b.phone}</p>}
          {b.email && <p>{b.email}</p>}
        </div>
        <div className="p-end">
          <p className="p-title">{isCredit ? "FACTURE D’AVOIR" : "FACTURE"}</p>
          <p className="p-strong">N° {inv.no}</p>
          <p>Date : {dateLabel(inv.date, "fr")}</p>
          <p>{isCredit ? `Avoir ${sale.no}` : `Vente ${sale.no}`}</p>
          {isCredit && <p>Se rapporte {correcting ? `à la facture ${correcting}` : `à la vente ${sale.return_of_no}`}</p>}
        </div>
      </header>

      <section className="p-client">
        <p className="p-label">Facturé à</p>
        <p className="p-strong">{inv.customer_name}</p>
        {inv.customer_address && <p>{inv.customer_address}</p>}
        {inv.customer_ice && <p>ICE {inv.customer_ice}</p>}
      </section>

      <table className="p-table">
        <thead>
          <tr>
            <th>Désignation</th>
            <th className="num">Qté</th>
            <th className="num">P.U. TTC</th>
            <th className="num">Remise</th>
            <th className="num">Total TTC</th>
          </tr>
        </thead>
        <tbody>
          {sale.lines.map((l) => (
            <tr key={l.id}>
              <td>
                {l.product} <span className="p-muted">({l.sku})</span>
              </td>
              <td className="num">
                {qty(Math.abs(l.qty))}
                {l.unit !== "U" && ` ${l.unit}`}
              </td>
              <td className="num">{mad(l.unit_price)}</td>
              <td className="num">{l.discount_pct ? `${qty(l.discount_pct)} %` : "—"}</td>
              <td className="num">{mad(Math.abs(l.total))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="p-totals">
        <tbody>
          {rate > 0 && (
            <>
              <tr>
                <td>Total HT</td>
                <td className="num">{mad(ht)}</td>
              </tr>
              <tr>
                <td>TVA {qty(rate)} %</td>
                <td className="num">{mad(ttc - ht)}</td>
              </tr>
            </>
          )}
          <tr className="p-strong">
            <td>{isCredit ? "Total de l’avoir TTC" : "Total TTC"}</td>
            <td className="num">{mad(ttc)} MAD</td>
          </tr>
          {!isCredit && sale.payment && (
            <tr>
              <td>Règlement</td>
              <td className="num">{sale.paid ? `${sale.payment} — réglée` : `${sale.payment} — reste ${mad(sale.owed)}`}</td>
            </tr>
          )}
        </tbody>
      </table>

      <p className="p-words">
        Arrêtée la présente {isCredit ? "facture d’avoir" : "facture"} à la somme de : <strong>{amountInWords(ttc)}</strong> TTC.
      </p>

      <footer className="p-foot">
        {b.invoice_footer && <p>{b.invoice_footer}</p>}
        {legal.length > 0 && <p>{legal.join(" · ")}</p>}
      </footer>
    </article>
  );
}
