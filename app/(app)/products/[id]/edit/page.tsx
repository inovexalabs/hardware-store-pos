import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isUuid } from '@/utils/format';
import { requirePermission } from '@/lib/auth/guards';
import { getProduct, listCategories, listBrands, listUnits } from '@/services/products';
import { listSuppliers } from '@/services/parties';
import { getShopSettings } from '@/services/settings';
import { PageHeader } from '@/components/shared/page-header';
import { ProductForm } from '@/components/products/product-form';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export const metadata = { title: 'Edit Product' };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission('products.write');
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const product = await getProduct(id);
  if (!product) notFound();

  const [categories, brands, units, suppliers, settings] = await Promise.all([
    listCategories(),
    listBrands(),
    listUnits(),
    listSuppliers({ perPage: 100 }),
    getShopSettings(),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Edit Product"
        description={
          <>
            Changes apply to future sales and purchases. Past bills stay as they were.
          </>
        }
        actions={
          <Button variant="outline" asChild>
            <Link href={`/products/${product.id}`}>
              <ArrowLeft data-icon="inline-start" />
              Back to Product
            </Link>
          </Button>
        }
      />
      <ProductForm
        product={product}
        categories={categories}
        brands={brands}
        units={units}
        suppliers={suppliers.rows}
        defaultTaxRate={settings.tax_rate}
      />
    </div>
  );
}
