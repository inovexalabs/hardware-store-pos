import Link from 'next/link';
import { requirePermission } from '@/lib/auth/guards';
import { listPostingAccounts } from '@/services/accounting';
import { PageHeader } from '@/components/shared/page-header';
import { JournalEntryForm } from '@/components/accounting/journal-entry-form';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export const metadata = { title: 'New Journal Entry' };

export default async function NewJournalEntryPage() {
  await requirePermission('accounting.write');
  const accounts = await listPostingAccounts();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="New Journal Entry"
        description="For money that does not come from a sale, purchase, payment or expense — owner’s capital, drawings, bank deposits, loans, VAT payments."
        actions={
          <Button variant="outline" asChild>
            <Link href="/accounting/journal">
              <ArrowLeft data-icon="inline-start" />
              Journal
            </Link>
          </Button>
        }
      />
      <JournalEntryForm
        accounts={accounts.map(({ id, code, name, type, system_key }) => ({ id, code, name, type, system_key }))}
      />
    </div>
  );
}
