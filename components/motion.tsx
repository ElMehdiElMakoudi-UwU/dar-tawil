"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * The site's quiet movement, in one rAF loop:
 *  - `--scroll` on <html>: 0 → 1 page progress, read by the header's gold hairline.
 *  - `[data-parallax="0.12"]`: drifts against the scroll by that fraction of
 *    its distance from the viewport centre, written as `--py`.
 *  - `[data-pointer]`: the pointer's offset from the element's centre, -1 → 1,
 *    written as `--mx` / `--my` for the CSS to use as it likes.
 *
 * Everything is written as custom properties, so the CSS decides what moves
 * and reduced-motion visitors simply get no values.
 */
export function Motion() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const root = document.documentElement;
    const layers = Array.from(document.querySelectorAll<HTMLElement>("[data-parallax]"));
    const pointers = Array.from(document.querySelectorAll<HTMLElement>("[data-pointer]"));
    let frame = 0;

    const tick = () => {
      frame = 0;
      const vh = window.innerHeight;
      const max = root.scrollHeight - vh;
      root.style.setProperty("--scroll", max > 0 ? (window.scrollY / max).toFixed(4) : "0");

      for (const el of layers) {
        const box = el.getBoundingClientRect();
        if (box.bottom < -200 || box.top > vh + 200) continue;
        const speed = Number(el.dataset.parallax) || 0.1;
        const offset = (box.top + box.height / 2 - vh / 2) * speed;
        el.style.setProperty("--py", `${offset.toFixed(1)}px`);
      }
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const fine = window.matchMedia("(pointer: fine)").matches;
    const onPointer = (event: PointerEvent) => {
      for (const el of pointers) {
        const box = el.getBoundingClientRect();
        if (event.clientY < box.top || event.clientY > box.bottom) continue;
        const x = ((event.clientX - box.left) / box.width) * 2 - 1;
        const y = ((event.clientY - box.top) / box.height) * 2 - 1;
        el.style.setProperty("--mx", x.toFixed(3));
        el.style.setProperty("--my", y.toFixed(3));
      }
    };

    tick();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    if (fine) window.addEventListener("pointermove", onPointer, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("pointermove", onPointer);
    };
  }, [pathname]);

  return null;
}
