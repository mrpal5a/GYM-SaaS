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
