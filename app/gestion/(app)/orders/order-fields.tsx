"use client";

import { useState } from "react";
import { mad } from "@/lib/gestion/format";
import { fill } from "@/lib/gestion/i18n";
import type { Order } from "@/lib/gestion/queries";
import { Submit } from "../../_components/forms";
import { useT } from "../../_components/i18n";
import { blankLine, LineEditor, linesTotal, toLine, type Line, type Product } from "../sales/line-editor";

type Customer = { name: string; phone: string | null; city: string | null };

/**
 * Shared by "new order" and the edit page. Picking a known customer fills
 * their phone and city when those are still empty; the address only shows
 * for deliveries. The product lines become the sale once it is delivered.
 */
export function OrderFields({
  o,
  products,
  customers,
  channels,
  payments,
  today,
}: {
  o?: Order;
  products: Product[];
  customers: Customer[];
  channels: string[];
  payments: string[];
  today: string;
}) {
  const t = useT();
  const [fulfilment, setFulfilment] = useState(o?.fulfilment ?? "delivery");
  const [phone, setPhone] = useState(o?.phone ?? "");
  const [city, setCity] = useState(o?.city ?? "");
  const [lines, setLines] = useState<Line[]>(() => (o?.lines.length ? o.lines.map(toLine) : [blankLine()]));
  const byName = new Map(customers.map((c) => [c.name.toLowerCase(), c]));
  // New orders default to the WhatsApp channel and cash on delivery when those exist.
  const channel = o ? o.channel : (channels.find((c) => /whatsapp/i.test(c)) ?? channels[0]);
  const payment = o ? o.payment : (payments.find((p) => /delivery/i.test(p)) ?? payments[0]);

  return (
    <div className="space-y-4">
      {o && <input type="hidden" name="id" value={o.id} />}

      <div className="g-card grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block sm:col-span-2">
          <span className="g-label">{t.prep.customerName}</span>
          <input
            className="g-input"
            name="customer"
            list="order-customers"
            defaultValue={o?.customer_name}
            autoComplete="off"
            required
            onChange={(e) => {
              const c = byName.get(e.target.value.trim().toLowerCase());
              if (!c) return;
              if (!phone && c.phone) setPhone(c.phone);
              if (!city && c.city) setCity(c.city);
            }}
          />
          <datalist id="order-customers">
            {customers.map((c) => (
              <option key={c.name} value={c.name} />
            ))}
          </datalist>
        </label>
        <label className="block">
          <span className="g-label">{t.common.phone}</span>
          <input className="g-input" name="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label className="block">
          <span className="g-label">{t.prep.channel}</span>
          <select className="g-input" name="channel" defaultValue={channel ?? ""}>
            <option value="">—</option>
            {channels.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="g-card grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="g-label">{t.prep.dueDate}</span>
          <input className="g-input" type="date" name="due_date" defaultValue={o?.due_date ?? today} required />
        </label>
        <label className="block">
          <span className="g-label">{t.prep.dueTime}</span>
          <input className="g-input" type="time" name="due_time" defaultValue={o?.due_time ?? ""} />
        </label>
        <fieldset className="sm:col-span-2">
          <legend className="g-label">{t.prep.fulfilment}</legend>
          <div className="flex flex-wrap gap-2">
            {(["delivery", "pickup"] as const).map((f) => (
              <label
                key={f}
                className={`g-btn g-btn-ghost flex-1 ${fulfilment === f ? "border-[var(--color-or)] bg-[var(--color-brou-clair)]" : ""}`}
              >
                <input
                  type="radio"
                  name="fulfilment"
                  value={f}
                  checked={fulfilment === f}
                  onChange={() => setFulfilment(f)}
                  className="sr-only"
                />
                {f === "delivery" ? t.prep.delivery : t.prep.pickup}
              </label>
            ))}
          </div>
        </fieldset>
        {fulfilment === "delivery" && (
          <>
            <label className="block sm:col-span-2 lg:col-span-3">
              <span className="g-label">{t.prep.address}</span>
              <input className="g-input" name="address" defaultValue={o?.address ?? ""} />
            </label>
            <label className="block">
              <span className="g-label">{t.common.city}</span>
              <input className="g-input" name="city" value={city} onChange={(e) => setCity(e.target.value)} />
            </label>
          </>
        )}
      </div>

      <section>
        <h2 className="mb-2 text-lg">{t.prep.products}</h2>
        <LineEditor products={products} lines={lines} setLines={setLines} />
      </section>

      <div className="g-card grid gap-4">
        <label className="block">
          <span className="g-label">{t.prep.items}</span>
          <textarea className="g-input" name="items" rows={2} defaultValue={o?.items ?? ""} placeholder={t.prep.itemsPh} />
        </label>
        <label className="block">
          <span className="g-label">{t.prep.notes}</span>
          <textarea className="g-input" name="notes" rows={2} defaultValue={o?.notes ?? ""} />
        </label>
      </div>

      <div className="g-card grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <span className="g-label">{t.prep.totalMad}</span>
          <p className="py-2 text-lg font-medium tabular-nums">{mad(linesTotal(lines))}</p>
        </div>
        <label className="block">
          <span className="g-label">{t.prep.depositMad}</span>
          <input className="g-input" name="deposit" inputMode="decimal" defaultValue={o?.deposit || ""} placeholder="0" />
        </label>
        <label className="block">
          <span className="g-label">{t.prep.paymentMethod}</span>
          <select className="g-input" name="payment" defaultValue={payment ?? ""}>
            <option value="">—</option>
            {payments.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 self-end pb-2">
          <input type="checkbox" name="paid" defaultChecked={o?.paid} className="size-4 accent-[var(--color-accent)]" />
          {t.prep.fullyPaid}
        </label>
      </div>

      <p className="g-muted text-sm">{o?.sale_no ? fill(t.prep.editDelivered, { no: o.sale_no }) : t.prep.becomesSale}</p>
      <Submit>{o ? t.prep.saveChanges : t.prep.saveNew}</Submit>
    </div>
  );
}
