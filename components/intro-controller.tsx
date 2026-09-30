"use client";

import { useEffect } from "react";

const FLY_EASE = "cubic-bezier(0.65, 0, 0.35, 1)";
const FLY_MS = 900;
/** How long the name waits behind the mark before following it. */
const WORD_LAG_MS = 220;

/**
 * Once the mark is built, flies it into the header's own mark, the name after
 * it into the header's wordmark, and fades the curtain away underneath — then
 * hands over to the real header. A click or key press cuts it short.
 *
 * The CSS fades the curtain out on its own after a few seconds, so if this
 * never runs (or runs late) the page is still reachable.
 */
export function IntroController() {
  useEffect(() => {
    const root = document.documentElement;
    const el = document.getElementById("intro");
    if (!el || !root.classList.contains("intro")) return;

    const finish = () => root.classList.remove("intro", "intro-fly", "intro-skip");

    // Hydrated after the CSS fail-safe already hid it: just clean up.
    if (getComputedStyle(el).visibility === "hidden") {
      finish();
      return;
    }

    const mark = el.querySelector<HTMLElement>(".intro-mark");
    const word = el.querySelector<HTMLElement>(".intro-word");
    const rule = el.querySelector<HTMLElement>(".intro-rule");
    const running: Animation[] = [];
    let cancelled = false;
    let timer = 0;

    /** Transform that lands `from` exactly on `to`'s box, or null if `to` isn't shown. */
    const flight = (from: HTMLElement, to: Element | null) => {
      const a = from.getBoundingClientRect();
      const b = to?.getBoundingClientRect();
      if (!b || !b.width || !b.height) return null;
      const dx = b.left - a.left;
      const dy = b.top - a.top;
      return `translate(${dx}px, ${dy}px) scale(${b.width / a.width}, ${b.height / a.height})`;
    };

    const fly = (from: HTMLElement | null, to: Element | null, delay: number) => {
      if (!from) return;
      const land = flight(from, to);
      from.style.transformOrigin = "0 0";
      const anim = from.animate(
        land
          ? [{ transform: "none" }, { transform: land }]
          : // nowhere to land (the header hides its name on small screens): fade out
            [{ opacity: 1 }, { opacity: 0 }],
        { duration: FLY_MS, delay, easing: FLY_EASE, fill: "forwards" },
      );
      running.push(anim);
    };

    const start = () => {
      if (cancelled) return;
      const header = document.querySelector("header");
      root.classList.add("intro-fly");
      fly(mark, header?.querySelector(".mark") ?? null, 0);
      fly(word, header?.querySelector(".wordmark") ?? null, WORD_LAG_MS);
      if (rule) {
        running.push(
          rule.animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: 300,
            fill: "forwards",
          }),
        );
      }
      Promise.all(running.map((a) => a.finished))
        .then(() => !cancelled && finish())
        .catch(() => {});
    };

    // Take off once the name has settled — whether that's still to come or,
    // on a slow hydration, already over.
    const settled = word?.getAnimations()[0]?.finished ?? Promise.resolve();
    settled.then(() => {
      timer = window.setTimeout(start, 180);
    }).catch(() => {});

    const skip = () => {
      if (cancelled) return;
      cancelled = true;
      window.clearTimeout(timer);
      root.classList.add("intro-skip");
    };

    // The fade-out (skip or fail-safe) ending is what takes the curtain down.
    const ended = (e: AnimationEvent) => {
      if (e.target !== el) return;
      cancelled = true;
      finish();
    };

    el.addEventListener("animationend", ended);
    el.addEventListener("click", skip);
    window.addEventListener("keydown", skip, { once: true });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      running.forEach((a) => a.cancel());
      el.removeEventListener("animationend", ended);
      el.removeEventListener("click", skip);
      window.removeEventListener("keydown", skip);
    };
  }, []);

  return null;
}
