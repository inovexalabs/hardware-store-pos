// Browser-only helpers (use from Client Components).

/**
 * Phone photos are often 3–8 MB. Resize to at most `maxSide` pixels and
 * re-encode as JPEG so receipts upload quickly on shop Wi-Fi and stay
 * readable. Returns the original file if it cannot be decoded here
 * (the server then decides whether the type is allowed).
 */
export async function shrinkImage(file: File, maxSide = 1600, quality = 0.82): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file;
  }

  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    return file;
  }
  // white background so transparent PNGs don't turn black as JPEG
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality)
  );
  if (!blob || (blob.size >= file.size && file.type === 'image/jpeg')) return file;

  const name = file.name.replace(/\.[^.]+$/, '') || 'receipt';
  return new File([blob], `${name}.jpg`, { type: 'image/jpeg' });
}
