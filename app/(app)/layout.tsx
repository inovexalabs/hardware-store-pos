import { requireProfile } from '@/lib/auth/guards';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { AppHeader } from '@/components/layout/app-header';
import { MobileNav } from '@/components/layout/mobile-nav';
import { GlobalScanHandler } from '@/components/devices/global-scan-handler';
import { DeviceMonitor } from '@/components/devices/device-monitor';
import { hasPermission } from '@/lib/permissions';
import type { UserRole } from '@/types/database';

export interface NavUser {
  name: string;
  email: string | null;
  role: UserRole;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile();

  const user: NavUser = {
    name: profile.full_name || profile.email || 'Staff member',
    email: profile.email,
    role: profile.role,
  };

  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar user={user} />

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader user={user} />
        <DeviceMonitor />
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 pb-28 sm:px-6 lg:pb-10">
          {children}
        </main>
      </div>

      <MobileNav user={user} />
      <GlobalScanHandler canCreateProduct={hasPermission(profile.role, 'products.write')} />
    </div>
  );
}
