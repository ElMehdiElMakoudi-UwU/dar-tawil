"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, type FormEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/lib/gestion/form";
import { useT } from "./i18n";

type Action = (state: FormState, fd: FormData) => Promise<FormState>;

const Pending = createContext(false);

/**
 * Submits through onSubmit instead of the form's `action` prop: React resets
 * an action form after every submit, which would wipe what was typed when
 * the server says no. Here fields are only cleared on success.
 */
export function useSubmit(run: (fd: FormData) => void) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => run(fd));
  };
}

/**
 * A form wired to a server action: shows the action's error or success
 * message, and clears its fields after a successful save (unless `keep`).
 */
export function ActionForm({
  action,
  children,
  className,
  keep = false,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  keep?: boolean;
}) {
  const [state, run, pending] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  const onSubmit = useSubmit(run);

  useEffect(() => {
    if (state?.ok && !keep) ref.current?.reset();
  }, [state, keep]);

  return (
    <form ref={ref} onSubmit={onSubmit} className={className}>
      <Pending value={pending}>{children}</Pending>
      <Message state={state} />
    </form>
  );
}

export function Message({ state }: { state: FormState }) {
  if (!state?.error && !state?.ok) return null;
  return (
    <p
      key={state.at}
      role={state.error ? "alert" : "status"}
      className={`mt-3 text-sm ${state.error ? "text-[var(--g-bad)]" : "text-[var(--g-good)]"}`}
    >
      {state.error ?? state.ok}
    </p>
  );
}

export function Submit({
  children,
  className = "g-btn",
  pending: explicit,
}: {
  children: ReactNode;
  className?: string;
  pending?: boolean;
}) {
  const t = useT();
  const fromContext = useContext(Pending);
  const { pending: fromForm } = useFormStatus();
  const pending = explicit ?? (fromContext || fromForm);
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? t.common.saving : children}
    </button>
  );
}

/**
 * One-click action (mark paid, delete…). Hidden fields ride along; `confirm`
 * asks first. Errors show inline next to the button.
 */
export function ActionButton({
  action,
  fields,
  children,
  confirm: question,
  className = "g-btn g-btn-ghost g-btn-sm",
}: {
  action: Action;
  fields: Record<string, string | number>;
  children: ReactNode;
  confirm?: string;
  className?: string;
}) {
  const [state, run, pending] = useActionState(action, undefined);
  return (
    <form
      action={run}
      className="inline"
      onSubmit={(e) => {
        if (question && !window.confirm(question)) e.preventDefault();
      }}
    >
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button type="submit" className={className} disabled={pending}>
        {children}
      </button>
      {state?.error && <span className="ms-2 text-xs text-[var(--g-bad)]">{state.error}</span>}
    </form>
  );
}
