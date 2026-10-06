'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { GlobalSearch } from './global-search';
import { hasPermission } from '@/lib/permissions';
import { logout } from '@/actions/auth.actions';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, LogOut, Plus, ScanBarcode, Settings } from 'lucide-react';
import type { NavUser } from '@/app/(app)/layout';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  manager: 'Manager',
  cashier: 'Cashier',
  inventory: 'Inventory staff',
};

export function AppHeader({ user }: { user: NavUser }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const initials = user.name
    .split(' ')
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="no-print sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center gap-3 px-4 sm:px-6">
        <Link href="/dashboard" className="flex items-center gap-2 lg:hidden">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            I
          </span>
          <span className="hidden font-semibold sm:block">Inovexa POS</span>
        </Link>

        <div className="hidden flex-1 md:block">
          <GlobalSearch />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {hasPermission(user.role, 'sales.create') && (
            <Button
              className="hidden sm:inline-flex"
              onClick={() => router.push('/sales/new')}
            >
              <Plus data-icon="inline-start" />
              New Sale
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                  {initials || '?'}
                </span>
                <span className="hidden max-w-[10rem] truncate sm:block">{user.name}</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>
                <span className="block truncate">{user.name}</span>
                <span className="block truncate text-xs font-normal text-muted-foreground">
                  {user.email}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled className="text-muted-foreground">
                Role: {ROLE_LABELS[user.role] ?? user.role}
              </DropdownMenuItem>
              {hasPermission(user.role, 'settings.manage') && (
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <Link href="/devices">
                  <ScanBarcode className="h-4 w-4" />
                  Scanner &amp; printer
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={loggingOut}
                onSelect={(e) => {
                  e.preventDefault();
                  setLoggingOut(true);
                  void logout();
                }}
              >
                <LogOut className="h-4 w-4" />
                {loggingOut ? 'Signing out…' : 'Sign out'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
