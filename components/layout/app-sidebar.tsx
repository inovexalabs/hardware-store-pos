'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { visibleNavItems } from '@/lib/permissions';
import { logout } from '@/actions/auth.actions';
import { cn } from '@/lib/utils';
import { LogOut, Package } from 'lucide-react';
import type { NavUser } from '@/app/(app)/layout';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  manager: 'Manager',
  cashier: 'Cashier',
  inventory: 'Inventory staff',
};

export function AppSidebar({ user, className }: { user: NavUser; className?: string }) {
  const pathname = usePathname();
  const items = visibleNavItems(user.role);
  const [loggingOut, setLoggingOut] = useState(false);

  return (
    <aside
      className={cn(
        'no-print sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-sidebar lg:flex',
        className
      )}
    >
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Package className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">Inovexa POS</p>
          <p className="truncate text-xs text-muted-foreground">Hardware shop</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4" aria-label="Main menu">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[0.95rem] font-medium transition-colors',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
              )}
            >
              <Icon className={cn('h-5 w-5 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t px-4 py-4">
        <p className="truncate text-sm font-medium">{user.name}</p>
        <p className="mb-3 truncate text-xs text-muted-foreground">
          {ROLE_LABELS[user.role] ?? user.role}
        </p>
        <button
          type="button"
          onClick={() => {
            setLoggingOut(true);
            void logout();
          }}
          disabled={loggingOut}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60"
        >
          <LogOut className="h-4 w-4" />
          {loggingOut ? 'Signing out…' : 'Sign out'}
        </button>
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          © Inovexa Labs
        </p>
      </div>
    </aside>
  );
}
