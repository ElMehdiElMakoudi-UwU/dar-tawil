"use client";

import { useEffect } from "react";

/** Print and close buttons, hidden on paper. `auto` opens the print dialog straight away (?print=1). */
export function PrintBar({ auto }: { auto: boolean }) {
  useEffect(() => {
    if (auto) window.print();
  }, [auto]);
  return (
    <nav className="p-bar">
      <button type="button" className="g-btn" onClick={() => window.print()}>
        Imprimer
      </button>
      <button type="button" className="g-btn g-btn-ghost" onClick={() => window.close()}>
        Fermer
      </button>
    </nav>
  );
}
