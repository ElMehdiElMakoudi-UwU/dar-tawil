"use client";

import { useActionState } from "react";
import { fill } from "@/lib/gestion/i18n";
import { setOrderStatus } from "../../actions";
import { useT } from "../../_components/i18n";

/** Any status at once: to step back after a wrong click, or to cancel. */
export function StatusMenu({ id, no, status, statuses }: { id: number; no: string; status: string; statuses: readonly string[] }) {
  const t = useT();
  const [state, run, pending] = useActionState(setOrderStatus, undefined);

  return (
    <form action={run} className="inline-flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <select
        name="status"
        className="g-input g-btn-sm w-auto"
        aria-label={t.prep.changeStatus}
        defaultValue={status}
        key={status}
        disabled={pending}
        onChange={(e) => {
          if (e.target.value === "cancelled" && !window.confirm(fill(t.prep.confirmCancel, { no }))) {
            e.target.value = status;
            return;
          }
          e.target.form?.requestSubmit();
        }}
      >
        {statuses.map((s) => (
          <option key={s} value={s}>
            {t.prep.statuses[s]}
          </option>
        ))}
      </select>
      {state?.error && <span className="text-xs text-[var(--g-bad)]">{state.error}</span>}
    </form>
  );
}
