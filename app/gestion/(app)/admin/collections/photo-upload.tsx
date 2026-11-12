"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { uploadImages } from "../../../catalog-actions";
import { Message } from "../../../_components/forms";
import { useT } from "../../../_components/i18n";
import { Icon } from "../../../_components/icons";

const LONG_EDGE = 1600;

/**
 * Shrinks a photo to 1600 px on its long edge, as JPEG on white (the site
 * shows packs on white), so a phone photo of several MB uploads as ~300 kB.
 */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, LONG_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.86),
  );
}

/** Picks one or more photos and adds them, in order, after the size's current ones. */
export function PhotoUpload({ variantId }: { variantId: number }) {
  const t = useT();
  const [state, run, pending] = useActionState(uploadImages, undefined);
  const [preparing, setPreparing] = useState(false);
  const [count, setCount] = useState(0);
  const [readError, setReadError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const busy = pending || preparing;

  async function onPick(files: FileList | null) {
    if (!files?.length) return;
    setReadError(null);
    setPreparing(true);
    setCount(files.length);
    const fd = new FormData();
    fd.set("variant_id", String(variantId));
    try {
      for (const f of Array.from(files)) {
        fd.append("photos", await shrink(f), f.name.replace(/\.\w+$/, "") + ".jpg");
      }
    } catch {
      setReadError(t.catalog.unreadable);
      setPreparing(false);
      if (input.current) input.current.value = "";
      return;
    }
    setPreparing(false);
    if (input.current) input.current.value = "";
    startTransition(() => run(fd));
  }

  return (
    <div>
      <label className={`g-btn g-btn-ghost g-btn-sm ${busy ? "pointer-events-none opacity-60" : ""}`}>
        <Icon name="plus" className="size-4" />
        {busy ? t.catalog.uploading.replace("{n}", String(count)) : t.catalog.addPhotos}
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          disabled={busy}
          onChange={(e) => onPick(e.currentTarget.files)}
        />
      </label>
      {readError ? (
        <p role="alert" className="mt-3 text-sm text-[var(--g-bad)]">
          {readError}
        </p>
      ) : (
        <Message state={state} />
      )}
    </div>
  );
}
