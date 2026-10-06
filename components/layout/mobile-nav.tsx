'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { visibleNavItems } from '@/lib/permissions';
import { logout } from '@/actions/auth.actions';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { LogOut, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NavUser } from '@/app/(app)/layout';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  manager: 'Manager',
  cashier: 'Cashier',
  inventory: 'Inventory staff',
};

export function MobileNav({ user }: { user: NavUser }) {
  const pathname = usePathname();
  const items = visibleNavItems(user.role);
  const primary = items.slice(0, 3);
  const rest = items.slice(3);
  const [open, setOpen] = useState(false);

  return (
    <>
      <nav
        aria-label="Main menu"
        className="no-print fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur lg:hidden"
      >
        <div className="mx-auto flex h-16 max-w-lg items-stretch">
          {primary.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className={cn(
                  'flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium',
                  rest.some((item) => pathname.startsWith(item.href))
                    ? 'text-primary'
                    : 'text-muted-foreground'
                )}
              >
                <Menu className="h-5 w-5" />
                More
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <div className="space-y-1">
                {rest.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium hover:bg-muted"
                    >
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      {item.label}
                    </Link>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    void logout();
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-base font-medium text-muted-foreground hover:bg-muted"
                >
                  <LogOut className="h-5 w-5" />
                  Sign out
                </button>
              </div>
              <p className="pt-2 text-sm text-muted-foreground">
                {user.name} · {ROLE_LABELS[user.role] ?? user.role} · © Inovexa Labs
              </p>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </>
  );
}
