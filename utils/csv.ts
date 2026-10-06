// =============================================================
//  CSV export helpers. Excel opens UTF-8 CSV correctly when the
//  file starts with a byte-order mark, so we always add one.
// =============================================================

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

function escapeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  // Neutralise spreadsheet formulas typed into names/notes.
  const safe = /^[=+\-@\t\r]/.test(text) && isNaN(Number(text)) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv<T>(columns: CsvColumn<T>[], rows: T[]): string {
  const lines = [columns.map((c) => escapeCell(c.header)).join(',')];
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCell(c.value(row))).join(','));
  }
  return '﻿' + lines.join('\r\n');
}

export function csvResponse(filename: string, csv: string): Response {
  const safeName = filename.replace(/[^A-Za-z0-9._-]/g, '_');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeName}"`,
      'Cache-Control': 'no-store',
    },
  });
}
