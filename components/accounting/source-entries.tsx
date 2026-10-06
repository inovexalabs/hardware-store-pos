import Link from 'next/link';
import { hasPermission } from '@/lib/permissions';
import { SOURCE_LABELS } from '@/lib/accounting';
import { listEntriesForSource } from '@/services/accounting';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate, formatRs } from '@/utils/format';
import { BookOpenText } from 'lucide-react';
import type { UserRole } from '@/types/database';

interface Props {
  /** id of the sale / purchase / return / expense */
  sourceId: string;
  role: UserRole;
}

/**
 * "In the books": the journal entries a document produced, for people
 * who can see the accounting books.  Renders nothing for everyone else.
 */
export async function SourceEntries({ sourceId, role }: Props) {
  if (!hasPermission(role, 'accounting.view')) return null;
  const entries = await listEntriesForSource(sourceId);
  if (entries.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpenText className="h-4 w-4" />
          In the books
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {entries.map((entry) => (
          <Link
            key={entry.id}
            href={`/accounting/journal/${entry.id}`}
            className="flex items-center justify-between gap-2 rounded-lg border p-3 text-sm hover:bg-muted"
          >
            <div>
              <p className="font-medium">{entry.entry_number}</p>
              <p className="text-xs text-muted-foreground">
                {SOURCE_LABELS[entry.source_type]} · {formatDate(entry.entry_date)}
              </p>
            </div>
            <Badge variant="outline">{formatRs(entry.total)}</Badge>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
