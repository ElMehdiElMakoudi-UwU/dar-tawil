import { palette } from "@/lib/theme";

/**
 * The monogram. The source art is raster, so it is used as an alpha mask and
 * filled with the site's own gold gradient — it stays crisp on any ground and
 * always matches the palette around it.
 */
export function Mark({
  className = "",
  title,
  src = "/brand/logo-mask.png",
}: {
  className?: string;
  title?: string;
  /** Another mask of the same frame — the intro builds the mark from its parts. */
  src?: string;
}) {
  return (
    <span
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={`mark block ${className}`}
      style={{ ["--mark-src" as string]: `url(${src})` }}
    />
  );
}

/** Name set as an engraved plaque: wide inscriptional caps, hairline above. */
export function Wordmark({
  className = "",
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  // A script face needs roughly twice the size of the caps to hold the same width.
  const scale = (
    palette === "blanc"
      ? {
          sm: "text-[1.35rem] md:text-[1.5rem]",
          md: "text-[1.8rem] md:text-[2rem]",
          lg: "text-[2.6rem] md:text-[3.3rem]",
        }
      : {
          sm: "text-[0.72rem] md:text-[0.78rem]",
          md: "text-[0.95rem] md:text-[1.05rem]",
          lg: "text-xl md:text-2xl",
        }
  )[size];

  return (
    <span
      className={`wordmark font-display uppercase text-or-clair ${scale} ${className}`}
      style={{ letterSpacing: "var(--tracking-monument)" }}
    >
      Dar&nbsp;Tawil
    </span>
  );
}
