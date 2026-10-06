'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { daysAgoInShopTimezone, startOfMonthInShopTimezone, todayInShopTimezone } from '@/utils/format';

interface Props {
  from: string;
  to: string;
  /** one "as of" date instead of a range (balance sheet) */
  asOf?: boolean;
}

function presets() {
  const today = todayInShopTimezone();
  return [
    { label: 'Today', from: today, to: today },
    { label: 'This month', from: startOfMonthInShopTimezone(), to: today },
    { label: 'Last 30 days', from: daysAgoInShopTimezone(29), to: today },
    { label: 'Last 90 days', from: daysAgoInShopTimezone(89), to: today },
    { label: 'This year', from: `${today.slice(0, 4)}-01-01`, to: today },
  ];
}

/** Month and year ends, for "as of" reports. */
function asOfPresets() {
  const today = todayInShopTimezone();
  const lastMonthEnd = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
  lastMonthEnd.setUTCDate(0);
  return [
    { label: 'Today', date: today },
    { label: 'End of last month', date: lastMonthEnd.toISOString().slice(0, 10) },
    { label: 'End of last year', date: `${Number(today.slice(0, 4)) - 1}-12-31` },
  ];
}

const inputClass =
  'h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

/** From/To dates with one-tap presets. Writes ?from=&to= to the URL. */
export function ReportDateRange({ from, to, asOf = false }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [fromValue, setFromValue] = useState(from);
  const [toValue, setToValue] = useState(to);

  function apply(nextFrom: string, nextTo: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('from', nextFrom);
    params.set('to', nextTo);
    params.delete('page');
    setFromValue(nextFrom);
    setToValue(nextTo);
    router.push(`${pathname}?${params.toString()}`);
  }

  if (asOf) {
    // the range start only matters for ledger links; keep it at or before the date
    const applyDate = (date: string) => apply(from <= date ? from : date, date);
    return (
      <form
        className="no-print mb-4 space-y-3 rounded-xl border bg-card p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (toValue) applyDate(toValue);
        }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-[10rem] flex-1 sm:max-w-xs">
            <label htmlFor="range-as-of" className="mb-1 block text-xs font-medium text-muted-foreground">
              As of date
            </label>
            <input
              id="range-as-of"
              type="date"
              value={toValue}
              max={todayInShopTimezone()}
              onChange={(e) => setToValue(e.target.value)}
              className={inputClass}
            />
          </div>
          <Button type="submit" disabled={!toValue}>
            Show
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {asOfPresets().map((preset) => (
            <Button
              key={preset.label}
              type="button"
              size="sm"
              variant={preset.date === to ? 'default' : 'outline'}
              onClick={() => applyDate(preset.date)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </form>
    );
  }

  return (
    <form
      className="no-print mb-4 space-y-3 rounded-xl border bg-card p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (fromValue && toValue) apply(fromValue, toValue);
      }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-[10rem] flex-1">
          <label htmlFor="range-from" className="mb-1 block text-xs font-medium text-muted-foreground">
            From date
          </label>
          <input
            id="range-from"
            type="date"
            value={fromValue}
            max={toValue || undefined}
            onChange={(e) => setFromValue(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="min-w-[10rem] flex-1">
          <label htmlFor="range-to" className="mb-1 block text-xs font-medium text-muted-foreground">
            To date
          </label>
          <input
            id="range-to"
            type="date"
            value={toValue}
            min={fromValue || undefined}
            onChange={(e) => setToValue(e.target.value)}
            className={inputClass}
          />
        </div>
        <Button type="submit" disabled={!fromValue || !toValue || fromValue > toValue}>
          Show
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {presets().map((preset) => {
          const active = preset.from === from && preset.to === to;
          return (
            <Button
              key={preset.label}
              type="button"
              size="sm"
              variant={active ? 'default' : 'outline'}
              onClick={() => apply(preset.from, preset.to)}
            >
              {preset.label}
            </Button>
          );
        })}
      </div>
    </form>
  );
}
