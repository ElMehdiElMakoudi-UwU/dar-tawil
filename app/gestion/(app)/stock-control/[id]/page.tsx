import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/gestion/auth";
import { evaluate } from "@/lib/gestion/control";
import { getControl, getControlLines, getControlSales, getTillGap } from "@/lib/gestion/controls";
import { dateLabel, mad } from "@/lib/gestion/format";
import { fill } from "@/lib/gestion/i18n";
import { getLang, getT } from "@/lib/gestion/lang";
import { deleteControl } from "../../../control-actions";
import { ActionButton } from "../../../_components/forms";
import { PageHeader, Stat } from "../../../_components/ui";
import { ReviewTable } from "./review-table";
import { SalesSection } from "./sales-section";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).control.resultsTitle };
}

/** Counted against expected, product by product, biggest gaps first. */
export default async function ControlResultsPage({ params }: PageProps<"/gestion/stock-control/[id]">) {
  await requireAdmin();
  const controlId = Number((await params).id);
  if (!Number.isInteger(controlId)) notFound();
  const control = await getControl(controlId);
  if (!control) notFound();
  const until = control.closed_at?.slice(0, 10);
  const [lines, sales, till, lang, t] = await Promise.all([
    getControlLines(controlId),
    getControlSales(controlId),
    getTillGap(control.start_date, until),
    getLang(),
    getT(),
  ]);

  const ev = lines.map(evaluate).filter((e) => e != null);
  const flagged = ev.filter((e) => e.flagged).length;
  const netCost = ev.reduce((s, e) => s + e.atCost, 0);
  const missingPrice = ev.reduce((s, e) => s + Math.min(e.atPrice, 0), 0);
  const open = control.status === "open";

  return (
    <>
      <PageHeader
        title={control.label}
        sub={
          <>
            {fill(t.control.startedOn, { date: dateLabel(control.start_date, lang) })}
            {" · "}
            {open ? (
              <span className="g-badge g-badge-warn">{t.control.statusOpen}</span>
            ) : (
              <span className="g-badge g-badge-muted">
                {fill(t.control.statusClosed, { date: dateLabel(until!, lang), name: control.closed_by ?? "—" })}
              </span>
            )}
          </>
        }
      >
        <Link href="/gestion/stock-control" className="g-btn g-btn-ghost g-btn-sm">
          {t.control.back}
        </Link>
        {open && (
          <Link href={`/gestion/stock-control/${control.id}/count`} className="g-btn g-btn-sm">
            {t.control.countBtn}
          </Link>
        )}
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label={t.control.countedCol} value={`${ev.length} / ${lines.length}`} note={control.aligned ? t.control.alignedNote : t.control.notAlignedNote} />
        <Stat label={t.control.flaggedCol} value={flagged} tone={flagged ? "bad" : ev.length ? "good" : undefined} note={t.control.flaggedNote} />
        <Stat label={t.control.gapCost} value={mad(netCost)} tone={netCost < 0 ? "bad" : undefined} note={t.control.netNote} />
        <Stat label={t.control.missingPrice} value={mad(missingPrice)} tone={missingPrice < 0 ? "bad" : undefined} note={t.control.missingNote} />
        <Stat
          label={t.control.tillGap}
          value={till.counted ? mad(till.gap) : "—"}
          tone={till.gap < 0 ? "bad" : undefined}
          note={fill(t.control.tillNote, { n: till.counted, days: till.days })}
        />
      </div>

      <ReviewTable controlId={control.id} lines={lines} open={open} corrected={control.corrected} />

      <SalesSection control={control} lines={lines} sales={sales} />

      {open && (
        <div className="mt-8 border-t border-[var(--g-line)] pt-4">
          <ActionButton action={deleteControl} fields={{ id: control.id }} confirm={t.control.confirmDelete} className="g-link-danger text-sm">
            {t.control.delete}
          </ActionButton>
          <p className="g-muted mt-1 text-xs">{t.control.deleteNote}</p>
        </div>
      )}
      <p className="g-muted mt-4 text-xs">{t.control.method}</p>
    </>
  );
}
