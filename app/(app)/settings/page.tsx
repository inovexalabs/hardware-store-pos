import Link from 'next/link';
import { requirePermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { getShopSettings } from '@/services/settings';
import { PageHeader } from '@/components/shared/page-header';
import { InvoiceCard, ShopCard, TaxCard } from '@/components/settings/settings-cards';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronRight, History, ScanBarcode, Users } from 'lucide-react';

export const metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const ctx = await requirePermission('settings.manage');
  const role = ctx.profile.role;
  const settings = await getShopSettings();

  const links = [
    hasPermission(role, 'users.manage') && {
      href: '/settings/users',
      icon: Users,
      title: 'Staff & logins',
      description: 'Add staff, choose what each person can do, reset passwords.',
    },
    hasPermission(role, 'audit.view') && {
      href: '/settings/audit',
      icon: History,
      title: 'Activity history',
      description: 'Who changed what, and when — sales, prices, stock, settings.',
    },
    {
      href: '/devices',
      icon: ScanBarcode,
      title: 'Scanner & printer',
      description: 'Connect and test the barcode scanner and receipt printer on this computer.',
    },
  ].filter(Boolean) as { href: string; icon: typeof Users; title: string; description: string }[];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Settings" description="Your shop details, invoices, VAT and staff." />

      {links.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {links.map((link) => (
            <Link key={link.href} href={link.href}>
              <Card className="h-full transition-colors hover:border-primary/50">
                <CardContent className="flex items-center gap-4 p-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
                    <link.icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{link.title}</span>
                    <span className="block text-sm text-muted-foreground">{link.description}</span>
                  </span>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <ShopCard settings={settings} />
      <InvoiceCard settings={settings} />
      <TaxCard settings={settings} />
    </div>
  );
}
