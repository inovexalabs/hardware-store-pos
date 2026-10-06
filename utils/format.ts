// =============================================================
//  Formatting helpers — used EVERYWHERE so money and dates
//  always look the same:  Rs. 1,250.00   |   06 Oct 2026
//  All dates are shown in the shop's timezone: Asia/Kathmandu
// =============================================================

export const SHOP_TIMEZONE = 'Asia/Kathmandu';

const moneyFormatter = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 3,
});

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: SHOP_TIMEZONE,
});

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
  timeZone: SHOP_TIMEZONE,
});

const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
  timeZone: SHOP_TIMEZONE,
});

/** Rs. 1,250.00 */
export function formatRs(amount: number | null | undefined): string {
  const value = Number(amount ?? 0);
  return `Rs. ${moneyFormatter.format(isFinite(value) ? value : 0)}`;
}

/** Plain number: 1,250.5 */
export function formatNumber(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  return numberFormatter.format(isFinite(n) ? n : 0);
}

/** Stock/quantities: 12 pcs, 2.5 m — the unit is supplied by the caller */
export function formatQty(quantity: number | null | undefined, unit?: string): string {
  const n = formatNumber(quantity);
  return unit ? `${n} ${unit}` : n;
}

/** 06 Oct 2026 */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(date.getTime())) return '—';
  return dateFormatter.format(date);
}

/** 10:30 AM */
export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(date.getTime())) return '—';
  return timeFormatter.format(date);
}

/** 06 Oct 2026, 10:30 AM */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(date.getTime())) return '—';
  return dateTimeFormatter.format(date);
}

/** Today's date in the shop timezone, as YYYY-MM-DD (for date inputs) */
export function todayInShopTimezone(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: SHOP_TIMEZONE,
  }).format(new Date());
  return parts;
}

/** First day of the current month in the shop timezone */
export function startOfMonthInShopTimezone(): string {
  const today = todayInShopTimezone();
  return `${today.slice(0, 7)}-01`;
}

/** A "nice" label for a date range in reports */
export function formatDateRange(from: string, to: string): string {
  return `${formatDate(from)} — ${formatDate(to)}`;
}

/** N days before today in the shop timezone, as YYYY-MM-DD */
export function daysAgoInShopTimezone(days: number): string {
  const today = new Date(`${todayInShopTimezone()}T00:00:00Z`);
  today.setUTCDate(today.getUTCDate() - days);
  return today.toISOString().slice(0, 10);
}

/** Accepts only real YYYY-MM-DD dates (URL params are untrusted). */
export function isIsoDate(value: string | null | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value)));
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  bank: 'Bank / eSewa',
  wallet: 'Digital Wallet',
  credit: 'Credit',
};

/** Cash · Bank / eSewa · Digital Wallet · Credit */
export function paymentMethodLabel(method: string | null | undefined): string {
  if (!method) return '—';
  return PAYMENT_METHOD_LABELS[method] ?? method;
}

/** Read ?from=&to= safely; falls back to `defaultFrom`..today and fixes reversed ranges. */
export function resolveDateRange(
  params: { from?: string; to?: string },
  defaultFrom: string = startOfMonthInShopTimezone()
): { from: string; to: string } {
  const to = isIsoDate(params.to) ? params.to : todayInShopTimezone();
  const from = isIsoDate(params.from) ? params.from : defaultFrom;
  return from <= to ? { from, to } : { from: to, to: from };
}

/** Route/URL ids must be UUIDs before they reach the database. */
export function isUuid(value: string | null | undefined): value is string {
  return Boolean(
    value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}
