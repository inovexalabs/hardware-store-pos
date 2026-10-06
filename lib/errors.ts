// =============================================================
//  Friendly error messages.
//  A shop owner must NEVER see a raw database error.
//  Every message answers: what happened, why, what to do next.
// =============================================================

interface RawError {
  message?: string;
  code?: string;
  hint?: string;
  details?: string;
}

/** Messages raised by our database functions are already human friendly. */
const FRIENDLY_PREFIXES = [
  'you do not have permission',
  'the cart is empty',
  'quantity must be',
  'price cannot',
  'discount cannot',
  'paid amount',
  'please choose a customer',
  'credit sale',
  'only ',
  'one of the products',
  'invoice ',
  'purchase ',
  'this sale',
  'this purchase',
  'this invoice',
  'return quantity',
  'you can only return',
  'this product was not',
  'unit conversion is missing',
  'enter an amount',
  'choose a valid',
  'amount is more than',
  'customer not found',
  'supplier not found',
  'product not found',
  'stock cannot',
  'stock is already',
  'please write a reason',
  'initial stock can only',
  'this product is inactive',
  'cannot cancel',
  'no products added',
  'select at least one',
  'at least one active owner',
  'you cannot change your own',
  'user not found',
  'line discount is more',
  'duplicate key',
  'already paid',
  // accounting
  'write what this entry',
  'choose the date of the entry',
  'the entry date',
  'an entry needs',
  'each line needs',
  'debits (',
  'account not found',
  'the account ',
  'the books ',
  'journal entry not found',
  'this entry was already',
  'enter an account code',
  'enter the account name',
  'choose the account type',
  'another account',
  'built-in accounts',
  'this account ',
  'stock value already',
];

const KNOWN_PATTERNS: { test: RegExp; message: string }[] = [
  // ---- unique constraints (friendly wording for duplicates) ----
  { test: /products_sku_key/i, message: 'That item code (SKU) is already used. Choose a different one.' },
  { test: /products_barcode_key/i, message: 'That barcode already belongs to another product. Check the barcode.' },
  { test: /customers_name_key/i, message: 'A customer with this name already exists.' },
  { test: /suppliers_name_key/i, message: 'A supplier with this name already exists.' },
  { test: /categories_name_key/i, message: 'That category already exists.' },
  { test: /brands_name_key/i, message: 'That brand already exists.' },
  { test: /units_name_key/i, message: 'That unit already exists.' },
  { test: /expense_categories_name_key/i, message: 'That expense category already exists.' },
  { test: /sales_invoice_number_key/i, message: 'That invoice number already exists. Please try again.' },
  { test: /purchases_purchase_number_key/i, message: 'That purchase number already exists. Please try again.' },
  { test: /users_email_key/i, message: 'An account with this email already exists.' },

  // ---- row level security / permissions ----
  { test: /row-level security/i, message: 'You do not have permission to do this. Ask the shop owner to help.' },
  { test: /permission denied/i, message: 'You do not have permission to do this. Ask the shop owner to help.' },

  // ---- auth ----
  { test: /invalid login credentials/i, message: 'Email or password is incorrect. Please try again.' },
  { test: /email not confirmed/i, message: 'This email is not verified yet. Check your inbox for the confirmation link.' },
  { test: /user already registered/i, message: 'An account with this email already exists. Try signing in instead.' },
  { test: /rate limit/i, message: 'Too many attempts. Please wait a minute and try again.' },
  { test: /fetch failed|networkerror|failed to fetch/i, message: 'No internet connection. Check your connection and try again.' },

  // ---- constraints ----
  { test: /ck_sales|ck_purchases|ck_sales_returns/i, message: 'The amounts do not add up. Please check total, paid and due values.' },
  { test: /_amount_check|_quantity_check|_price_check/i, message: 'One of the values is not allowed (amount, quantity or price must be greater than zero).' },
  { test: /foreign key/i, message: 'This record is linked to other data and cannot be removed. Deactivate it instead.' },

  // ---- stock ----
  { test: /negative stock|stock cannot be less than zero/i, message: 'Stock cannot go below zero.' },
];

/**
 * Turn any thrown error into a message we can safely show in the UI.
 */
export function friendlyError(error: unknown): string {
  const err = error as RawError;
  const raw = String(err?.message ?? error ?? '').trim();
  if (!raw) return 'Something went wrong. Please try again.';

  const lower = raw.toLowerCase();

  // Our database functions raise messages that are already written for the owner.
  for (const prefix of FRIENDLY_PREFIXES) {
    if (lower.startsWith(prefix)) return capitalize(raw);
  }

  // Known error signatures → friendly wording.
  for (const { test, message } of KNOWN_PATTERNS) {
    if (test.test(raw)) return message;
  }

  // PostgREST sometimes wraps the real message:  "duplicate key...: Detail: ..."
  if (lower.includes('duplicate key')) {
    return 'This value is already used. Choose a different one.';
  }

  // Anything unrecognised: keep it generic but actionable.
  console.error('[friendlyError]', error);
  return 'Something went wrong and the action was not saved. Please try again.';
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Extract the useful part of a Postgres error message (drops "Detail:" tails). */
export function errorMessage(error: unknown): string {
  return friendlyError(error);
}
