import Link from 'next/link';
import { requirePermission } from '@/lib/auth/guards';
import { listProducts, listBrands, listCategories, type StockStatusFilter, type ProductSort } from '@/services/products';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { FilterBar } from '@/components/shared/filter-bar';
import { Pagination } from '@/components/shared/pagination';
import { ProductTable } from '@/components/products/product-table';
import { Button } from '@/components/ui/button';
import { PackagePlus, Package } from 'lucide-react';

export const metadata = { title: 'Products' };

interface SearchParams {
  q?: string;
  category?: string;
  brand?: string;
  stock?: string;
  sort?: string;
  page?: string;
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requirePermission('products.view');
  const params = await searchParams;

  const stock = (['in', 'low', 'out'] as const).includes(params.stock as 'in')
    ? (params.stock as StockStatusFilter)
    : 'all';
  const sort = (['name', 'stock', 'selling_price', 'newest'] as const).includes(
    params.sort as ProductSort
  )
    ? (params.sort as ProductSort)
    : 'name';

  const [result, categories, brands] = await Promise.all([
    listProducts({
      search: params.q,
      category_id: params.category,
      brand_id: params.brand,
      stock,
      sort,
      page: Number(params.page) || 1,
      perPage: 20,
    }),
    listCategories(),
    listBrands(),
  ]);

  const query = {
    q: params.q,
    category: params.category,
    brand: params.brand,
    stock: params.stock,
    sort: params.sort,
  };

  const hasFilters = Boolean(params.q || params.category || params.brand || stock !== 'all');

  return (
    <div>
      <PageHeader
        title="Products"
        description={
          result.count > 0
            ? `${result.count} product${result.count === 1 ? '' : 's'} in your shop`
            : undefined
        }
        actions={
          <Button asChild>
            <Link href="/products/new">
              <PackagePlus data-icon="inline-start" />
              Add Product
            </Link>
          </Button>
        }
      />

      <FilterBar
        searchPlaceholder="Search name, item code or barcode…"
        searchValue={params.q ?? ''}
        selects={[
          {
            name: 'category',
            label: 'Category',
            value: params.category ?? '',
            options: [
              { value: '', label: 'All categories' },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ],
          },
          {
            name: 'brand',
            label: 'Brand',
            value: params.brand ?? '',
            options: [
              { value: '', label: 'All brands' },
              ...brands.map((b) => ({ value: b.id, label: b.name })),
            ],
          },
          {
            name: 'stock',
            label: 'Stock',
            value: stock === 'all' ? '' : stock,
            options: [
              { value: '', label: 'All stock' },
              { value: 'in', label: 'In Stock' },
              { value: 'low', label: 'Low Stock' },
              { value: 'out', label: 'Out of Stock' },
            ],
          },
          {
            name: 'sort',
            label: 'Sort by',
            value: sort,
            options: [
              { value: 'name', label: 'Name (A–Z)' },
              { value: 'newest', label: 'Newest first' },
              { value: 'stock', label: 'Stock (high to low)' },
              { value: 'selling_price', label: 'Price (high to low)' },
            ],
          },
        ]}
      />

      {result.count === 0 ? (
        hasFilters ? (
          <EmptyState
            icon={Package}
            title="No products found."
            description="Try a different search, or clear the filters to see everything."
          />
        ) : (
          <EmptyState
            icon={Package}
            title="No products yet."
            description="Add your first product to start selling and tracking stock."
            action={
              <Button asChild>
                <Link href="/products/new">
                  <PackagePlus data-icon="inline-start" />
                  Add your first product
                </Link>
              </Button>
            }
          />
        )
      ) : (
        <>
          <ProductTable rows={result.rows} />
          <Pagination page={result.page} totalPages={result.totalPages} basePath="/products" query={query} />
        </>
      )}
    </div>
  );
}
