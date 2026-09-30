import type { ReactNode } from "react";
import { LangSwitch } from "./lang-switch";

/** Centered card for the sign-in and first-run screens. */
export function AuthCard({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <LangSwitch />
        </div>
        <div className="mb-8 text-center">
          <p className="eyebrow">Dar Tawil</p>
          <h1 className="mt-2 text-3xl">{title}</h1>
          <p className="g-muted mt-2 text-sm">{sub}</p>
        </div>
        <div className="g-card">{children}</div>
      </div>
    </main>
  );
}
