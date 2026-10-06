import Link from 'next/link';
import { requirePermission } from '@/lib/auth/guards';
import { listExpenseCategories } from '@/services/expenses';
import { PageHeader } from '@/components/shared/page-header';
import { ExpenseForm } from '@/components/expenses/expense-form';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export const metadata = { title: 'Add Expense' };

export default async function NewExpensePage() {
  await requirePermission('expenses.write');
  const categories = await listExpenseCategories();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Add Expense"
        description="Rent, electricity, salaries, transport — anything the shop spends that is not stock."
        actions={
          <Button variant="outline" asChild>
            <Link href="/expenses">
              <ArrowLeft data-icon="inline-start" />
              All Expenses
            </Link>
          </Button>
        }
      />
      <ExpenseForm categories={categories} />
    </div>
  );
}
