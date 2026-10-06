import Link from 'next/link';
import { requirePermission } from '@/lib/auth/guards';
import { listCategories, listBrands, listUnits } from '@/services/products';
import { listSuppliers } from '@/services/parties';
import { getShopSettings } from '@/services/settings';
import { PageHeader } from '@/components/shared/page-header';
import { ProductForm } from '@/components/products/product-form';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export const metadata = { title: 'Add Product' };

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ barcode?: string }>;
}) {
  await requirePermission('products.write');
  const { barcode } = await searchParams;

  const [categories, brands, units, suppliers, settings] = await Promise.all([
    listCategories(),
    listBrands(),
    listUnits(),
    listSuppliers({ perPage: 100, activeOnly: true }),
    getShopSettings(),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Add Product"
        description="Add a new item to your shop. You can change everything later."
        actions={
          <Button variant="outline" asChild>
            <Link href="/products">
              <ArrowLeft data-icon="inline-start" />
              Back to Products
            </Link>
          </Button>
        }
      />
      <ProductForm
        categories={categories}
        brands={brands}
        units={units}
        suppliers={suppliers.rows}
        defaultTaxRate={settings.tax_rate}
        defaultBarcode={barcode?.trim().slice(0, 60)}
      />
    </div>
  );
}
