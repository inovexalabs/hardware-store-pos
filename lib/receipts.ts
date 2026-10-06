// =============================================================
//  Expense receipt files — rules shared by the browser, the
//  form validation and the server.  Receipts are financial
//  records, so they live in a PRIVATE bucket and are only shown
//  through short-lived signed links after a permission check.
// =============================================================

export const RECEIPT_BUCKET = 'expense-receipts';

/** Accepted file types → stored extension. Photos are converted to JPG in the browser. */
export const RECEIPT_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export const MAX_RECEIPT_BYTES = 4 * 1024 * 1024; // 4 MB

/** Only paths our own upload produced may be saved on an expense. */
export const RECEIPT_PATH_PATTERN =
  /^receipts\/\d{4}-\d{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|pdf)$/;

export function isPdfReceipt(path: string | null | undefined): boolean {
  return Boolean(path?.endsWith('.pdf'));
}
