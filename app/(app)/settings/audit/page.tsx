import Link from 'next/link';
import { requirePermission } from '@/lib/auth/guards';
import { getUser, listAuditLogs } from '@/services/settings';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { FilterBar } from '@/components/shared/filter-bar';
import { DateRangeFilter } from '@/components/shared/date-range-filter';
import { Pagination } from '@/components/shared/pagination';
import { AUDIT_ENTITIES, AuditTable } from '@/components/settings/audit-table';
import { Button } from '@/components/ui/button';
import { isIsoDate, isUuid } from '@/utils/format';
import { ArrowLeft, History } from 'lucide-react';

export const metadata = { title: 'Activity History' };

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    entity?: string;
    user?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  await requirePermission('audit.view');
  const params = await searchParams;
  const entity = AUDIT_ENTITIES.some((e) => e.value === params.entity) ? params.entity : undefined;
  const userId = isUuid(params.user) ? params.user : undefined;

  const [result, person] = await Promise.all([
    listAuditLogs({
      search: params.q,
      entity,
      userId,
      from: isIsoDate(params.from) ? params.from : undefined,
      to: isIsoDate(params.to) ? params.to : undefined,
      page: Number(params.page) || 1,
      perPage: 30,
    }),
    userId ? getUser(userId) : Promise.resolve(null),
  ]);

  const query = { q: params.q, entity, user: userId, from: params.from, to: params.to };
  const hasFilters = Boolean(params.q || entity || userId || params.from || params.to);

  return (
    <div>
      <PageHeader
        title="Activity History"
        description={
          person
            ? `Everything ${person.full_name} has done.`
            : 'A permanent record of who changed what. Entries cannot be edited or deleted.'
        }
        actions={
          <Button variant="outline" asChild>
            <Link href="/settings">
              <ArrowLeft data-icon="inline-start" />
              Settings
            </Link>
          </Button>
        }
      />

      <FilterBar
        searchPlaceholder="e.g. cancelled, price, login…"
        searchValue={params.q ?? ''}
        selects={[
          {
            name: 'entity',
            label: 'Area',
            value: entity ?? '',
            options: [{ value: '', label: 'Everything' }, ...AUDIT_ENTITIES],
          },
        ]}
      >
        <DateRangeFilter />
      </FilterBar>

      {person && (
        <p className="mb-4 text-sm text-muted-foreground">
          Showing {person.full_name} only.{' '}
          <Link href="/settings/audit" className="underline">
            Show everyone
          </Link>
        </p>
      )}

      {result.count === 0 ? (
        <EmptyState
          icon={History}
          title={hasFilters ? 'Nothing matches these filters.' : 'No activity yet.'}
          description={hasFilters ? 'Try another area or date range.' : 'Changes will be recorded here automatically.'}
        />
      ) : (
        <>
          <AuditTable rows={result.rows} />
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            basePath="/settings/audit"
            query={query}
          />
        </>
      )}
    </div>
  );
}
