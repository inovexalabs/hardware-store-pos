import Link from 'next/link';
import { requirePermission } from '@/lib/auth/guards';
import { listUsers } from '@/services/settings';
import { PageHeader } from '@/components/shared/page-header';
import { ActiveBadge, RoleBadge } from '@/components/shared/status-badge';
import { CreateUserDialog } from '@/components/settings/user-form';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateTime } from '@/utils/format';
import { ArrowLeft, Pencil } from 'lucide-react';

export const metadata = { title: 'Staff & Logins' };

export default async function UsersPage() {
  const ctx = await requirePermission('users.manage');
  const users = await listUsers();

  return (
    <div>
      <PageHeader
        title="Staff & Logins"
        description="Everyone who can sign in, and what they are allowed to do."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/settings">
                <ArrowLeft data-icon="inline-start" />
                Settings
              </Link>
            </Button>
            <CreateUserDialog />
          </>
        }
      />

      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Added</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id} className={user.is_active ? undefined : 'opacity-60'}>
                <TableCell className="font-medium">
                  {user.full_name}
                  {user.id === ctx.userId && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">(you)</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{user.email ?? '—'}</TableCell>
                <TableCell>
                  <RoleBadge role={user.role} />
                </TableCell>
                <TableCell>
                  <ActiveBadge active={user.is_active} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDateTime(user.created_at)}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/settings/users/${user.id}`}>
                      <Pencil data-icon="inline-start" />
                      Manage
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="space-y-3 md:hidden">
        {users.map((user) => (
          <li key={user.id}>
            <Link href={`/settings/users/${user.id}`} className="block rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">
                  {user.full_name}
                  {user.id === ctx.userId ? ' (you)' : ''}
                </span>
                <RoleBadge role={user.role} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
              {!user.is_active && (
                <div className="mt-2">
                  <ActiveBadge active={false} />
                </div>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
