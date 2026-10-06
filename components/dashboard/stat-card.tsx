import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Props {
  label: string;
  value: string;
  icon?: LucideIcon;
  /** subtle tone: neutral | success | warning | danger | primary */
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'primary';
  hint?: string;
  href?: string;
}

const TONES = {
  neutral: 'text-foreground',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-destructive',
  primary: 'text-primary',
} as const;

export function StatCard({ label, value, icon: Icon, tone = 'neutral', hint, href }: Props) {
  const body = (
    <Card className={cn('transition-colors hover:border-primary/40')}>
      <CardContent className="flex items-start gap-3 p-4 sm:p-5">
        {Icon && (
          <span
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted',
              TONES[tone]
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
        )}
        <span className="min-w-0">
          <span className="block text-sm text-muted-foreground">{label}</span>
          <span className={cn('block text-xl font-semibold tracking-tight sm:text-2xl', TONES[tone])}>
            {value}
          </span>
          {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
        </span>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{body}</Link>;
  }
  return body;
}
