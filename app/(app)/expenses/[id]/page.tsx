import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { getExpense, listExpenseCategories } from '@/services/expenses';
import { PageHeader } from '@/components/shared/page-header';
import { ExpenseForm } from '@/components/expenses/expense-form';
import { SourceEntries } from '@/components/accounting/source-entries';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate, formatDateTime, formatRs, isUuid, paymentMethodLabel } from '@/utils/format';
import { isPdfReceipt } from '@/lib/receipts';
import { ArrowLeft, FileText, Paperclip } from 'lucide-react';

export const metadata = { title: 'Expense' };

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const ctx = await requirePermission('expenses.view');
  const canWrite = hasPermission(ctx.profile.role, 'expenses.write');

  const [expense, categories] = await Promise.all([getExpense(id), listExpenseCategories()]);
  if (!expense) notFound();

  // keep the current category selectable even if it was switched off
  const options = categories.some((c) => c.id === expense.category_id)
    ? categories
    : [...categories, { ...expense.category, is_active: false, created_at: '' }];

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={`${expense.category?.name ?? 'Expense'} — ${formatRs(expense.amount)}`}
        description={`${formatDate(expense.spent_on)} · entered ${formatDateTime(expense.created_at)}${
          expense.profile?.full_name ? ` by ${expense.profile.full_name}` : ''
        }`}
        actions={
          <Button variant="outline" asChild>
            <Link href="/expenses">
              <ArrowLeft data-icon="inline-start" />
              All Expenses
            </Link>
          </Button>
        }
      />

      {canWrite ? (
        <ExpenseForm categories={options} expense={expense} canDelete />
      ) : (
        <Card>
          <CardContent className="space-y-3 p-6 text-sm">
            <p>
              <span className="text-muted-foreground">Category:</span> {expense.category?.name}
            </p>
            <p>
              <span className="text-muted-foreground">Amount:</span> {formatRs(expense.amount)}
            </p>
            <p>
              <span className="text-muted-foreground">Paid by:</span>{' '}
              {paymentMethodLabel(expense.method)}
            </p>
            {expense.description && <p className="rounded-lg bg-muted p-3">{expense.description}</p>}
            {expense.receipt_url ? (
              <a
                href={`/expenses/${expense.id}/receipt`}
                target="_blank"
                rel="noreferrer"
                className="block rounded-lg border p-2 hover:border-primary/50"
              >
                {isPdfReceipt(expense.receipt_url) ? (
                  <span className="flex items-center gap-2 p-2 font-medium">
                    <FileText className="h-5 w-5" />
                    Open receipt (PDF)
                  </span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- private signed image
                  <img
                    src={`/expenses/${expense.id}/receipt`}
                    alt="Receipt"
                    className="max-h-96 w-full rounded-md object-contain"
                  />
                )}
              </a>
            ) : (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Paperclip className="h-4 w-4" />
                No receipt attached.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="mt-6">
        <SourceEntries sourceId={expense.id} role={ctx.profile.role} />
      </div>
    </div>
  );
}
