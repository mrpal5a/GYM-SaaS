// Client-side image downscaling. Runs in the browser before upload so large
// phone photos become small, predictable files — keeps storage tidy and avoids
// hitting server upload limits. Best-effort: on any failure it returns the
// original file so the upload still proceeds.

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Downscale an image file so its longest edge is at most `maxDim` px, re-encoding
 * to a compressed JPEG (or PNG when the source is a PNG, to keep transparency).
 * Returns the original file untouched for SVGs, non-images, or any failure.
 */
export async function resizeImageFile(
  file: File,
  maxDim = 512,
  quality = 0.85,
): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return file;

  try {
    const img = await loadImage(await readAsDataURL(file));
    const longest = Math.max(img.width, img.height);
    const scale = Math.min(1, maxDim / longest);

    // Already small in both dimensions and bytes — nothing to gain.
    if (scale >= 1 && file.size <= 1_000_000) return file;

    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);

    const isPng = file.type === "image/png";
    const outType = isPng ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, outType, isPng ? undefined : quality),
    );
    if (!blob) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "logo";
    return new File([blob], `${baseName}.${isPng ? "png" : "jpg"}`, { type: outType });
  } catch {
    return file;
  }
}

/**
 * Compress an image down to (at most) a target byte budget, re-encoding to JPEG.
 * It first scales the longest edge to `startDim`, then steps quality down; if it
 * still overshoots at `minQuality`, it shrinks the dimensions and tries again.
 * Returns the smallest result it produced (best-effort) — and the untouched
 * original for SVGs, non-images, or any failure, so the upload always proceeds.
 *
 * Used to keep stored member photos (~50 KB) and payment screenshots (~20 KB)
 * tiny, which is what lets the free 1 GB of storage hold thousands of members.
 * JPEG only on purpose: these are photos, so transparency isn't needed and JPEG
 * compresses far smaller than PNG.
 */
export async function compressImageToTarget(
  file: File,
  opts: { maxBytes: number; startDim?: number; minDim?: number; minQuality?: number },
): Promise<File> {
  const { maxBytes, startDim = 1024, minDim = 320, minQuality = 0.4 } = opts;
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return file;

  try {
    const img = await loadImage(await readAsDataURL(file));
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    let best: Blob | null = null;

    // Outer loop shrinks the canvas; inner loop lowers JPEG quality. Stop as soon
    // as something fits the budget, keeping the smallest blob seen as a fallback.
    for (
      let dim = Math.min(startDim, Math.max(img.width, img.height));
      dim >= minDim;
      dim = Math.round(dim * 0.8)
    ) {
      const scale = dim / Math.max(img.width, img.height);
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      canvas.width = w;
      canvas.height = h;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      for (let q = 0.82; q >= minQuality; q -= 0.12) {
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", q),
        );
        if (!blob) continue;
        if (!best || blob.size < best.size) best = blob;
        if (blob.size <= maxBytes) {
          return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
        }
      }
    }

    // Never got under budget — hand back the smallest we made (still far smaller
    // than the original), or the original if every encode failed.
    return best ? new File([best], `${baseName}.jpg`, { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}
