'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ShopCard } from '@/components/settings/settings-cards';
import { setOnboardingDone } from '@/actions/settings.actions';
import type { ShopSettings } from '@/types/database';
import { CheckCircle2, Loader2, Package, Truck, Users } from 'lucide-react';

/** First run: shop details, then a few pointers on where to start. */
export function SetupWizard({ settings }: { settings: ShopSettings }) {
  const router = useRouter();
  const [step, setStep] = useState<'shop' | 'next'>('shop');
  const [finishing, setFinishing] = useState(false);

  async function finish(href: string) {
    setFinishing(true);
    try {
      const result = await setOnboardingDone(true);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push(href);
      router.refresh();
    } finally {
      setFinishing(false);
    }
  }

  if (step === 'shop') {
    return (
      <ShopCard settings={settings} onSaved={() => setStep('next')} submitLabel="Save and Continue" />
    );
  }

  const nextSteps = [
    { href: '/products/new', icon: Package, title: 'Add your products', text: 'Name, price, and how many you have now.' },
    { href: '/suppliers', icon: Truck, title: 'Add your suppliers', text: 'So purchases and what you owe are tracked.' },
    { href: '/settings/users', icon: Users, title: 'Give staff their logins', text: 'Cashiers only see the sale screen.' },
  ];

  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        <p className="flex items-center gap-2 text-lg font-semibold">
          <CheckCircle2 className="text-success" />
          Your shop is ready.
        </p>
        <p className="text-sm text-muted-foreground">Where would you like to start?</p>
        <div className="grid gap-3">
          {nextSteps.map((item) => (
            <button
              key={item.href}
              type="button"
              disabled={finishing}
              onClick={() => finish(item.href)}
              className="flex items-center gap-4 rounded-xl border p-4 text-left transition-colors hover:border-primary/50 disabled:opacity-60"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
                <item.icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-semibold">{item.title}</span>
                <span className="block text-sm text-muted-foreground">{item.text}</span>
              </span>
            </button>
          ))}
        </div>
        <Button variant="outline" onClick={() => finish('/dashboard')} disabled={finishing}>
          {finishing && <Loader2 className="animate-spin" data-icon="inline-start" />}
          Go to the dashboard
        </Button>
      </CardContent>
    </Card>
  );
}
