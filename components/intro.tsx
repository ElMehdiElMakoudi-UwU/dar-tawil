import { IntroController } from "./intro-controller";
import { Mark, Wordmark } from "./mark";

/** The mark cut into the pieces it is built from, in the order they appear. */
const PARTS = ["arch", "palm", "letters"] as const;
const partSrc = (part: (typeof PARTS)[number]) => `/brand/logo-mask-${part}.png`;

/**
 * Runs while the HTML is still being parsed, before first paint, on every full
 * page load (first visit or refresh — not client-side navigation, where this
 * script is never re-run): it flags <html> so the overlay below shows, and
 * starts fetching the part masks so the arch isn't waiting on the network when
 * its cue comes. Reduced-motion and no-JS visitors never see it.
 */
const flagPageLoad = `try{if(!matchMedia("(prefers-reduced-motion: reduce)").matches){document.documentElement.classList.add("intro");${JSON.stringify(PARTS.map(partSrc))}.forEach(function(s){new Image().src=s})}}catch(e){}`;

/**
 * Page-load curtain: the monogram is built piece by piece — the arch rises
 * from its footings, the palm and its dates open out beneath the leaves, the
 * letters fade in — then light crosses the foil, the name follows, and
 * the whole thing lifts off the page.
 * Hidden by default in CSS — only `html.intro` displays it.
 */
export function Intro() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: flagPageLoad }} />
      <div id="intro" aria-hidden className="intro-curtain">
        <div className="intro-stage flex flex-col items-center">
          <div className="intro-mark relative h-36 w-[6.7rem] md:h-48 md:w-[8.95rem]">
            {PARTS.map((part) => (
              <Mark
                key={part}
                src={partSrc(part)}
                className={`intro-part intro-${part} absolute inset-0`}
              />
            ))}
          </div>
          <span className="intro-rule mt-8 block h-px w-28 bg-or/60" />
          <Wordmark size="lg" className="intro-word mt-5" />
        </div>
      </div>
      <IntroController />
    </>
  );
}
