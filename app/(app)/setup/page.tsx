import { requirePermission } from '@/lib/auth/guards';
import { getShopSettings } from '@/services/settings';
import { PageHeader } from '@/components/shared/page-header';
import { SetupWizard } from '@/components/settings/setup-wizard';

export const metadata = { title: 'Set up your shop' };

/** Shown once, right after the owner creates the shop account. */
export default async function SetupPage() {
  await requirePermission('settings.manage');
  const settings = await getShopSettings();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Welcome! Let’s set up your shop."
        description="This takes a minute. You can change everything later in Settings."
      />
      <SetupWizard settings={settings} />
    </div>
  );
}
