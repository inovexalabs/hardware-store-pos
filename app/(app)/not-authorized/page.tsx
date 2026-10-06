import Link from 'next/link';
import { requireProfile } from '@/lib/auth/guards';
import { visibleNavItems } from '@/lib/permissions';
import { RoleBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';

export const metadata = { title: 'Not allowed' };

/** Where page guards send people who open an area their role cannot use. */
export default async function NotAuthorizedPage() {
  const { profile } = await requireProfile();
  const allowed = visibleNavItems(profile.role);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-lg rounded-2xl border bg-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-warning-subtle">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-semibold">This area is not part of your job.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You are signed in as <RoleBadge role={profile.role} />. If you need access, ask the shop
          owner to change your role in Settings → Staff &amp; Logins.
        </p>
        {allowed.length > 0 && (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {allowed.map((item) => (
              <Button key={item.href} variant="outline" asChild>
                <Link href={item.href}>
                  <item.icon data-icon="inline-start" />
                  {item.label}
                </Link>
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
