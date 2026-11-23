"use client";

import { useActionState } from "react";
import { saveCollected } from "../../../control-actions";
import { Message, Submit, useSubmit } from "../../../_components/forms";
import { useT } from "../../../_components/i18n";

/** The money the owner collected over the control, typed by hand. */
export function CollectedForm({ controlId, amount, note }: { controlId: number; amount: number | null; note: string | null }) {
  const t = useT();
  const [state, run, pending] = useActionState(saveCollected, undefined);
  const onSubmit = useSubmit(run);
  return (
    <form onSubmit={onSubmit} className="g-card">
      <input type="hidden" name="id" value={controlId} />
      <div className="grid gap-3 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
        <label className="block">
          <span className="g-label">{t.control.collectedInput}</span>
          <input
            name="cash_collected"
            inputMode="decimal"
            className="g-input text-end tabular-nums"
            defaultValue={amount ?? ""}
            placeholder="0.00"
          />
        </label>
        <label className="block">
          <span className="g-label">{t.common.notes}</span>
          <input name="cash_note" className="g-input" defaultValue={note ?? ""} placeholder={t.control.collectedNotePh} />
        </label>
        <Submit pending={pending}>{t.common.save}</Submit>
      </div>
      <p className="g-muted mt-2 text-xs">{t.control.collectedHint}</p>
      <Message state={state} />
    </form>
  );
}
