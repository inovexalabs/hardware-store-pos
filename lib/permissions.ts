// =============================================================
//  Inovexa Labs — Hardware Shop POS
//  Permission matrix. This MIRRORS public.role_permissions in
//  the database (migration 00009_seed.sql).  The database is
//  the real enforcer (RLS + server checks); this file only
//  decides what the interface shows.
// =============================================================
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Truck,
  Users,
  Building2,
  Wallet,
  BarChart3,
  Settings,
  Undo2,
  ScanBarcode,
  BookOpenText,
  type LucideIcon,
} from 'lucide-react';
import type { UserRole } from '@/types/database';

export type Permission =
  | 'dashboard.view'
  | 'sales.view'
  | 'sales.create'
  | 'sales.cancel'
  | 'products.view'
  | 'products.write'
  | 'stock.adjust'
  | 'purchases.view'
  | 'purchases.write'
  | 'purchases.cancel'
  | 'returns.process'
  | 'customers.view'
  | 'customers.write'
  | 'suppliers.view'
  | 'suppliers.write'
  | 'payments.record'
  | 'expenses.view'
  | 'expenses.write'
  | 'reports.view'
  | 'accounting.view'
  | 'accounting.write'
  | 'data.export'
  | 'settings.manage'
  | 'users.manage'
  | 'audit.view';

const OWNER_PERMISSIONS: Permission[] = [
  'dashboard.view',
  'sales.view',
  'sales.create',
  'sales.cancel',
  'products.view',
  'products.write',
  'stock.adjust',
  'purchases.view',
  'purchases.write',
  'purchases.cancel',
  'returns.process',
  'customers.view',
  'customers.write',
  'suppliers.view',
  'suppliers.write',
  'payments.record',
  'expenses.view',
  'expenses.write',
  'reports.view',
  'accounting.view',
  'accounting.write',
  'data.export',
  'settings.manage',
  'users.manage',
  'audit.view',
];

/** Runs the shop floor — no settings, users, expenses, accounting books or audit. */
const MANAGER_PERMISSIONS: Permission[] = [
  'dashboard.view',
  'sales.view',
  'sales.create',
  'sales.cancel',
  'products.view',
  'products.write',
  'stock.adjust',
  'purchases.view',
  'purchases.write',
  'purchases.cancel',
  'returns.process',
  'customers.view',
  'customers.write',
  'suppliers.view',
  'suppliers.write',
  'payments.record',
  'reports.view',
  'data.export',
];

/** Counter sales only. */
const CASHIER_PERMISSIONS: Permission[] = [
  'dashboard.view',
  'sales.view',
  'sales.create',
  'products.view',
  'customers.view',
  'customers.write',
  'payments.record',
];

/** Stock, purchasing and purchase returns. */
const INVENTORY_PERMISSIONS: Permission[] = [
  'dashboard.view',
  'products.view',
  'products.write',
  'stock.adjust',
  'purchases.view',
  'purchases.write',
  'returns.process',
  'suppliers.view',
];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  owner: OWNER_PERMISSIONS,
  manager: MANAGER_PERMISSIONS,
  cashier: CASHIER_PERMISSIONS,
  inventory: INVENTORY_PERMISSIONS,
};

export function hasPermission(role: UserRole | null | undefined, code: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(code) ?? false;
}

export function hasAnyPermission(role: UserRole | null | undefined, codes: Permission[]): boolean {
  return codes.some((c) => hasPermission(role, c));
}

// -------------------------------------------------------------
//  Navigation — every item has an icon AND a text label
// -------------------------------------------------------------
export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: Permission;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard.view' },
  { href: '/sales', label: 'Sales', icon: ShoppingCart, permission: 'sales.view' },
  { href: '/products', label: 'Products', icon: Package, permission: 'products.view' },
  { href: '/purchases', label: 'Purchases', icon: Truck, permission: 'purchases.view' },
  { href: '/customers', label: 'Customers', icon: Users, permission: 'customers.view' },
  { href: '/suppliers', label: 'Suppliers', icon: Building2, permission: 'suppliers.view' },
  { href: '/expenses', label: 'Expenses', icon: Wallet, permission: 'expenses.view' },
  { href: '/returns', label: 'Returns', icon: Undo2, permission: 'returns.process' },
  { href: '/reports', label: 'Reports', icon: BarChart3, permission: 'reports.view' },
  { href: '/accounting', label: 'Accounting', icon: BookOpenText, permission: 'accounting.view' },
  { href: '/settings', label: 'Settings', icon: Settings, permission: 'settings.manage' },
  // every role works at a counter, so everyone can test the scanner/printer
  { href: '/devices', label: 'Devices', icon: ScanBarcode, permission: 'dashboard.view' },
];

export function visibleNavItems(role: UserRole | null | undefined): NavItem[] {
  return NAV_ITEMS.filter((item) => hasPermission(role, item.permission));
}

/** Which permission a route needs (used by the page guards). */
export const ROUTE_PERMISSIONS: Record<string, Permission> = {
  '/dashboard': 'dashboard.view',
  '/sales': 'sales.view',
  '/sales/new': 'sales.create',
  '/products': 'products.view',
  '/products/new': 'products.write',
  '/purchases': 'purchases.view',
  '/purchases/new': 'purchases.write',
  '/customers': 'customers.view',
  '/suppliers': 'suppliers.view',
  '/expenses': 'expenses.view',
  '/returns': 'returns.process',
  '/reports': 'reports.view',
  '/accounting': 'accounting.view',
  '/accounting/journal/new': 'accounting.write',
  '/settings': 'settings.manage',
  '/devices': 'dashboard.view',
};
