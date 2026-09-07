"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Reveals anything marked `data-reveal` as it enters the viewport.
 *
 * The hiding is applied by JS (via the `reveal-ready` class) rather than sitting
 * in the stylesheet, so a visitor without JS — or a crawler — gets the finished
 * page instead of an empty one.
 *
 * Keyed on the pathname: this component sits in the root layout, which does not
 * remount between routes, so without it a client-side navigation would render a
 * page whose elements are hidden and never observed.
 */
export function RevealOnScroll() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal]:not([data-shown])"),
    );
    if (!nodes.length) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || typeof IntersectionObserver === "undefined") return;

    root.classList.add("reveal-ready");

    const timers: number[] = [];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          const delay = Number(el.dataset.revealDelay ?? 0);
          timers.push(
            window.setTimeout(() => el.setAttribute("data-shown", ""), delay),
          );
          observer.unobserve(el);
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.06 },
    );

    nodes.forEach((n) => observer.observe(n));

    return () => {
      observer.disconnect();
      timers.forEach(clearTimeout);
      // Leave nothing hidden behind for the next route to inherit.
      root.classList.remove("reveal-ready");
      nodes.forEach((n) => n.removeAttribute("data-shown"));
    };
  }, [pathname]);

  return null;
}
