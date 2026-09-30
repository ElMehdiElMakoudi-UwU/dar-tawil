import Image from "next/image";
import { palette } from "@/lib/theme";
import { Lattice } from "./ornament";

let plateSeq = 0;

/**
 * An image slot. Until the client's photography arrives it renders a labelled
 * plate rather than a broken frame — drop a file in /public/photos and pass
 * `src` to swap it in.
 */
export function Photo({
  src,
  alt,
  caption,
  pending,
  shape = "arch",
  className = "",
  priority,
}: {
  src?: string;
  alt: string;
  /** Shown on the placeholder to tell the client which shot belongs here. */
  caption?: string;
  pending: string;
  shape?: "arch" | "square";
  className?: string;
  priority?: boolean;
}) {
  const id = `plate-${(plateSeq += 1)}`;
  const clip = shape === "arch" ? { clipPath: "url(#dt-arch)" } : undefined;

  return (
    <figure
      className={`relative overflow-hidden bg-brou ${className}`}
      style={clip}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes="(max-width: 768px) 92vw, 42vw"
          className="object-cover"
        />
      ) : (
        <>
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 90% at 50% 8%, var(--plate-top) 0%, var(--plate-mid) 46%, var(--plate-bot) 100%)",
            }}
          />
          <Lattice
            id={id}
            className={`absolute inset-0 ${palette === "blanc" ? "text-or/25" : "text-or/[0.13]"}`}
            scale={0.8}
            strokeWidth={1}
          />
          <figcaption className="absolute inset-0 flex flex-col items-center justify-end gap-2 p-7 text-center">
            <span className="eyebrow text-or/60">{pending}</span>
            {caption ? (
              <span className="max-w-[22ch] font-display text-sm leading-snug text-ivoire/45">
                {caption}
              </span>
            ) : null}
          </figcaption>
        </>
      )}
    </figure>
  );
}
