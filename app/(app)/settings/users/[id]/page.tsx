import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/guards';
import { getUser } from '@/services/settings';
import { PageHeader } from '@/components/shared/page-header';
import { ActiveBadge, RoleBadge } from '@/components/shared/status-badge';
import { EditUserForm, ResetPasswordForm } from '@/components/settings/user-form';
import { Button } from '@/components/ui/button';
import { formatDateTime, isUuid } from '@/utils/format';
import { ArrowLeft, History } from 'lucide-react';

export const metadata = { title: 'Manage Staff' };

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const ctx = await requirePermission('users.manage');

  const user = await getUser(id);
  if (!user) notFound();
  const isSelf = user.id === ctx.userId;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={user.full_name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{user.email}</span>
            <RoleBadge role={user.role} />
            <ActiveBadge active={user.is_active} />
            <span>· added {formatDateTime(user.created_at)}</span>
          </span>
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/settings/users">
                <ArrowLeft data-icon="inline-start" />
                All Staff
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/settings/audit?user=${user.id}`}>
                <History data-icon="inline-start" />
                Their Activity
              </Link>
            </Button>
          </>
        }
      />
      <EditUserForm user={user} isSelf={isSelf} />
      <ResetPasswordForm userId={user.id} name={user.full_name} />
    </div>
  );
}
