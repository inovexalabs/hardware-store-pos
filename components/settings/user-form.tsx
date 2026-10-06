'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { changeUserRole, createUser, resetUserPassword } from '@/actions/settings.actions';
import type { Profile, UserRole } from '@/types/database';
import { KeyRound, Loader2, Save, UserPlus } from 'lucide-react';

const ROLE_OPTIONS: { value: UserRole; label: string; description: string }[] = [
  { value: 'cashier', label: 'Cashier', description: 'Makes sales, adds customers and takes payments.' },
  {
    value: 'inventory',
    label: 'Inventory staff',
    description: 'Products, stock, purchases and returns to suppliers.',
  },
  {
    value: 'manager',
    label: 'Manager',
    description: 'Runs the shop floor: everything except expenses, settings and staff.',
  },
  { value: 'owner', label: 'Owner', description: 'Full access, including settings and staff.' },
];

function RolePicker({
  value,
  onChange,
  disabled,
}: {
  value: UserRole;
  onChange: (role: UserRole) => void;
  disabled?: boolean;
}) {
  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => onChange(v as UserRole)}
      className="grid gap-2"
      disabled={disabled}
    >
      {ROLE_OPTIONS.map((option) => (
        <Label
          key={option.value}
          htmlFor={`role-${option.value}`}
          className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
        >
          <RadioGroupItem id={`role-${option.value}`} value={option.value} className="mt-0.5" />
          <span>
            <span className="block font-medium">{option.label}</span>
            <span className="block text-sm text-muted-foreground">{option.description}</span>
          </span>
        </Label>
      ))}
    </RadioGroup>
  );
}

// -------------------------------------------------------------
//  Add a staff login
// -------------------------------------------------------------
export function CreateUserDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('cashier');

  function reset() {
    setFullName('');
    setEmail('');
    setPassword('');
    setRole('cashier');
  }

  async function handleCreate() {
    if (!fullName.trim() || !email.trim()) {
      toast.error("Enter the person's name and email.");
      return;
    }
    if (password.length < 8) {
      toast.error('The password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    try {
      const result = await createUser({
        full_name: fullName,
        email,
        password,
        role,
        is_active: true,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${fullName.trim()} can now sign in with ${email.trim()}.`);
      setOpen(false);
      reset();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus data-icon="inline-start" />
        Add Staff
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add a staff login</DialogTitle>
            <DialogDescription>
              Give the email and password to the person. They can sign in straight away.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-user-name">Name *</Label>
              <Input id="new-user-name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} autoFocus />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-user-email">Email *</Label>
                <Input
                  id="new-user-email"
                  type="email"
                  autoComplete="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-user-password">Password *</Label>
                <Input
                  id="new-user-password"
                  type="text"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>What can they do?</Label>
              <RolePicker value={role} onChange={setRole} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={busy}>
              {busy && <Loader2 className="animate-spin" data-icon="inline-start" />}
              Create Login
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// -------------------------------------------------------------
//  Edit an existing person
// -------------------------------------------------------------
export function EditUserForm({ user, isSelf }: { user: Profile; isSelf: boolean }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(user.full_name);
  const [role, setRole] = useState<UserRole>(user.role);
  const [active, setActive] = useState(user.is_active);
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    if (!fullName.trim()) {
      toast.error("Enter the person's name.");
      return;
    }
    setBusy(true);
    try {
      const result = await changeUserRole(user.id, role, active, fullName);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        active ? 'Changes saved.' : `${fullName.trim()} can no longer sign in.`
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Name, role and access</CardTitle>
        {isSelf && (
          <CardDescription>
            This is your own account. Another owner must change your role or switch you off.
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="edit-user-name">Name</Label>
          <Input id="edit-user-name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} />
        </div>
        <div className="space-y-2">
          <Label>Role</Label>
          <RolePicker value={role} onChange={setRole} disabled={isSelf} />
        </div>
        <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
          <div>
            <Label htmlFor="edit-user-active">Can sign in</Label>
            <p className="text-sm text-muted-foreground">
              Switch off when someone leaves. Their sales and history are kept.
            </p>
          </div>
          <Switch id="edit-user-active" checked={active} onCheckedChange={setActive} disabled={isSelf} />
        </div>
        <Button onClick={handleSave} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Save data-icon="inline-start" />}
          Save Changes
        </Button>
      </CardContent>
    </Card>
  );
}

export function ResetPasswordForm({ userId, name }: { userId: string; name: string }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleReset() {
    if (password.length < 8) {
      toast.error('The new password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    try {
      const result = await resetUserPassword(userId, password);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`New password set for ${name}. Give it to them in person.`);
      setPassword('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Reset password</CardTitle>
        <CardDescription>For when someone forgets theirs.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="reset-password">New password</Label>
          <Input
            id="reset-password"
            type="text"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </div>
        <Button variant="outline" onClick={handleReset} disabled={busy || password.length === 0}>
          {busy ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <KeyRound data-icon="inline-start" />}
          Set Password
        </Button>
      </CardContent>
    </Card>
  );
}
