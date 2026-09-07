/**
 * The monogram. The source art is raster, so it is used as an alpha mask and
 * filled with the site's own gold gradient — it stays crisp on any ground and
 * always matches the palette around it.
 */
export function Mark({
  className = "",
  title,
}: {
  className?: string;
  title?: string;
}) {
  return (
    <span
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={`mark block ${className}`}
      style={{ ["--mark-src" as string]: "url(/brand/logo-mask.png)" }}
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
  const scale = {
    sm: "text-[0.72rem] md:text-[0.78rem]",
    md: "text-[0.95rem] md:text-[1.05rem]",
    lg: "text-xl md:text-2xl",
  }[size];

  return (
    <span
      className={`font-display uppercase text-or-clair ${scale} ${className}`}
      style={{ letterSpacing: "var(--tracking-monument)" }}
    >
      Dar&nbsp;Tawil
    </span>
  );
}
