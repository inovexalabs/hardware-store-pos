'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import {
  createExpenseCategory,
  deleteExpense,
  saveExpense,
  uploadExpenseReceipt,
} from '@/actions/expense.actions';
import { ReceiptPicker, type ReceiptValue } from '@/components/expenses/receipt-picker';
import { todayInShopTimezone } from '@/utils/format';
import { Loader2, Plus, Save, Trash2, X } from 'lucide-react';
import type { Expense, ExpenseCategory } from '@/types/database';

interface Props {
  categories: Pick<ExpenseCategory, 'id' | 'name'>[];
  /** Leave empty to record a new expense. */
  expense?: Expense;
  canDelete?: boolean;
}

const METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank / eSewa' },
  { value: 'wallet', label: 'Digital Wallet' },
] as const;

export function ExpenseForm({ categories: initialCategories, expense, canDelete = false }: Props) {
  const router = useRouter();
  const editing = Boolean(expense);
  const [categories, setCategories] = useState(initialCategories);
  const [categoryId, setCategoryId] = useState(expense?.category_id ?? '');
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '');
  const [spentOn, setSpentOn] = useState(expense?.spent_on ?? todayInShopTimezone());
  const [method, setMethod] = useState<string>(
    expense && expense.method !== 'credit' ? expense.method : 'cash'
  );
  const [description, setDescription] = useState(expense?.description ?? '');
  const [receipt, setReceipt] = useState<ReceiptValue>(
    expense?.receipt_url ? { kind: 'existing', path: expense.receipt_url } : { kind: 'none' }
  );
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('');
  // a file already uploaded during a save that then failed — don't upload it twice
  const uploaded = useRef<{ file: File; path: string } | null>(null);

  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [categoryBusy, setCategoryBusy] = useState(false);

  async function handleAddCategory() {
    if (!newCategory.trim()) {
      toast.error('Enter the category name.');
      return;
    }
    setCategoryBusy(true);
    try {
      const result = await createExpenseCategory({ name: newCategory });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCategories((current) =>
        [...current, result.data].sort((a, b) => a.name.localeCompare(b.name))
      );
      setCategoryId(result.data.id);
      setNewCategory('');
      setAddingCategory(false);
      toast.success(`Category "${result.data.name}" added.`);
    } finally {
      setCategoryBusy(false);
    }
  }

  async function handleSave() {
    if (!categoryId) {
      toast.error('Choose an expense category.');
      return;
    }
    if (!(Number(amount) > 0)) {
      toast.error('Enter an amount greater than zero.');
      return;
    }
    if (!spentOn) {
      toast.error('Choose the date.');
      return;
    }
    setBusy(true);
    try {
      let receiptPath: string | null = receipt.kind === 'existing' ? receipt.path : null;
      if (receipt.kind === 'new') {
        if (uploaded.current?.file === receipt.file) {
          receiptPath = uploaded.current.path;
        } else {
          setBusyLabel('Uploading receipt…');
          const formData = new FormData();
          formData.append('file', receipt.file);
          const upload = await uploadExpenseReceipt(formData);
          if (!upload.ok) {
            toast.error(upload.error);
            return;
          }
          receiptPath = upload.data.path;
          uploaded.current = { file: receipt.file, path: receiptPath };
        }
      }

      setBusyLabel('Saving…');
      const result = await saveExpense(
        {
          category_id: categoryId,
          amount,
          spent_on: spentOn,
          method,
          description,
          receipt_url: receiptPath,
        },
        expense?.id
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(editing ? 'Expense updated.' : 'Expense saved.');
      router.push('/expenses');
      router.refresh();
    } finally {
      setBusy(false);
      setBusyLabel('');
    }
  }

  async function handleDelete() {
    if (!expense) return;
    const result = await deleteExpense(expense.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Expense deleted.');
    router.push('/expenses');
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="space-y-5 p-5 sm:p-6">
        <div className="space-y-2">
          <Label>Category *</Label>
          {addingCategory ? (
            <div className="flex gap-2">
              <Input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleAddCategory();
                  }
                }}
                placeholder="e.g. Generator fuel"
                maxLength={60}
                autoFocus
              />
              <Button onClick={handleAddCategory} disabled={categoryBusy}>
                {categoryBusy ? <Loader2 className="animate-spin" /> : <Plus />}
                Add
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Cancel new category"
                onClick={() => setAddingCategory(false)}
              >
                <X />
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="What was it for?" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => setAddingCategory(true)}>
                <Plus data-icon="inline-start" />
                New
              </Button>
            </div>
          )}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="expense-amount">Amount (Rs.) *</Label>
            <Input
              id="expense-amount"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expense-date">Date *</Label>
            <Input
              id="expense-date"
              type="date"
              value={spentOn}
              max={todayInShopTimezone()}
              onChange={(e) => setSpentOn(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Paid by</Label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METHODS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="expense-description">Details (optional)</Label>
          <Textarea
            id="expense-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder="e.g. Electricity bill for September"
          />
        </div>

        <ReceiptPicker
          value={receipt}
          onChange={setReceipt}
          expenseId={expense?.id}
          disabled={busy}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
          {editing && canDelete ? (
            <ConfirmDialog
              title="Delete this expense?"
              description="It will be removed from your expense list and profit reports. This cannot be undone."
              confirmLabel="Delete"
              onConfirm={handleDelete}
            >
              <Button variant="destructive">
                <Trash2 data-icon="inline-start" />
                Delete
              </Button>
            </ConfirmDialog>
          ) : (
            <span />
          )}
          <Button size="lg" onClick={handleSave} disabled={busy}>
            {busy ? (
              <Loader2 className="animate-spin" data-icon="inline-start" />
            ) : (
              <Save data-icon="inline-start" />
            )}
            {busy && busyLabel ? busyLabel : editing ? 'Save Changes' : 'Save Expense'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
