'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Save, Upload, X, Plus } from 'lucide-react';
import { saveProduct, createCategory, createBrand, uploadProductImage } from '@/actions/product.actions';
import { useActionResult } from '@/hooks/use-action-result';
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner';
import { useDevices } from '@/hooks/use-devices';
import { logDeviceEvent } from '@/lib/devices';
import { beepOk } from '@/utils/beep';
import type { ActionResult } from '@/lib/result';
import type { Brand, Category, ProductListItem, Supplier, Unit } from '@/types/database';

const NONE = '__none__';

interface FormState {
  name: string;
  sku: string;
  barcode: string;
  category_id: string;
  brand_id: string;
  unit_id: string;
  supplier_id: string;
  purchase_price: string;
  selling_price: string;
  wholesale_price: string;
  opening_stock: string;
  min_stock: string;
  rack: string;
  tax_rate: string;
  image_url: string;
  description: string;
  is_active: boolean;
}

interface Props {
  product?: ProductListItem;
  categories: Category[];
  brands: Brand[];
  units: Unit[];
  suppliers: Supplier[];
  defaultTaxRate: number;
  /** pre-filled barcode for a new product (e.g. after scanning an unknown label) */
  defaultBarcode?: string;
}

function toFormState(product?: ProductListItem, defaultTaxRate = 13, defaultBarcode = ''): FormState {
  return {
    name: product?.name ?? '',
    sku: product?.sku ?? '',
    barcode: product?.barcode ?? defaultBarcode,
    category_id: product?.category_id ?? NONE,
    brand_id: product?.brand_id ?? NONE,
    unit_id: product?.unit_id ?? '',
    supplier_id: product?.supplier_id ?? NONE,
    purchase_price: product ? String(product.purchase_price) : '',
    selling_price: product ? String(product.selling_price) : '',
    wholesale_price: product ? String(product.wholesale_price) : '',
    opening_stock: '',
    min_stock: product ? String(product.min_stock) : '',
    rack: product?.rack ?? '',
    tax_rate: String(product ? product.tax_rate : defaultTaxRate),
    image_url: product?.image_url ?? '',
    description: product?.description ?? '',
    is_active: product ? product.is_active : true,
  };
}

export function ProductForm({
  product,
  categories,
  brands,
  units,
  suppliers,
  defaultTaxRate,
  defaultBarcode,
}: Props) {
  const router = useRouter();
  const [values, setValues] = useState<FormState>(() =>
    toFormState(product, defaultTaxRate, defaultBarcode)
  );
  const { settings: device } = useDevices();

  // scanning anywhere on this form fills in the barcode
  useBarcodeScanner((code) => {
    setValues((current) => ({ ...current, barcode: code }));
    if (device.beepOnScan) beepOk();
    logDeviceEvent('scan', `Product form: barcode set to ${code}`);
    toast.success(`Barcode ${code} filled in from the scanner.`);
  });
  const [imageUploading, setImageUploading] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [brandOpen, setBrandOpen] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newBrand, setNewBrand] = useState('');

  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult<{ id: string }> | null): Promise<ActionResult<{ id: string }>> => {
      const input = {
        name: values.name,
        sku: values.sku,
        barcode: values.barcode || null,
        category_id: values.category_id === NONE ? null : values.category_id,
        brand_id: values.brand_id === NONE ? null : values.brand_id,
        unit_id: values.unit_id,
        supplier_id: values.supplier_id === NONE ? null : values.supplier_id,
        purchase_price: values.purchase_price,
        selling_price: values.selling_price,
        wholesale_price: values.wholesale_price || '0',
        opening_stock: values.opening_stock || '0',
        min_stock: values.min_stock || '0',
        rack: values.rack || null,
        tax_rate: values.tax_rate || '0',
        image_url: values.image_url || null,
        description: values.description || null,
        is_active: values.is_active,
      };
      return saveProduct(input, product?.id);
    },
    null
  );

  useActionResult(state, {
    successMessage: product ? 'Product saved.' : 'Product added successfully.',
    redirectTo: (data) => `/products/${data.id}`,
  });

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function handleImage(file: File | undefined) {
    if (!file) return;
    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await uploadProductImage(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      set('image_url', result.data.url);
      toast.success('Photo uploaded.');
    } finally {
      setImageUploading(false);
    }
  }

  async function handleCreateCategory() {
    const name = newCategory.trim();
    if (!name) return;
    const result = await createCategory(name);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    set('category_id', result.data.id);
    setNewCategory('');
    setCategoryOpen(false);
    toast.success('Category added.');
    router.refresh();
  }

  async function handleCreateBrand() {
    const name = newBrand.trim();
    if (!name) return;
    const result = await createBrand(name);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    set('brand_id', result.data.id);
    setNewBrand('');
    setBrandOpen(false);
    toast.success('Brand added.');
    router.refresh();
  }

  return (
    <form action={formAction} className="space-y-6">
      {/* ---------- Main info ---------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Product information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">Product name *</Label>
            <Input
              id="name"
              value={values.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. LED Bulb 9W Cool White"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sku">Item code (SKU) *</Label>
            <Input
              id="sku"
              value={values.sku}
              onChange={(e) => set('sku', e.target.value)}
              placeholder="e.g. ELE-012"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="barcode">Barcode</Label>
            <Input
              id="barcode"
              value={values.barcode}
              onChange={(e) => set('barcode', e.target.value)}
              onKeyDown={(e) => {
                // scanners press Enter after the code — that must not save the form
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (values.barcode.trim()) {
                    if (device.beepOnScan) beepOk();
                    logDeviceEvent('scan', `Product form: barcode set to ${values.barcode.trim()}`);
                  }
                }
              }}
              placeholder="Scan or type the barcode"
            />
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <div className="flex gap-2">
              <Select
                value={values.category_id}
                onValueChange={(value) => set('category_id', value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No category</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline" size="icon" aria-label="New category">
                    <Plus />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New category</DialogTitle>
                  </DialogHeader>
                  <Input
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="e.g. Electrical"
                    autoFocus
                  />
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setCategoryOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="button" onClick={handleCreateCategory}>
                      Add category
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Brand</Label>
            <div className="flex gap-2">
              <Select value={values.brand_id} onValueChange={(value) => set('brand_id', value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a brand" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No brand</SelectItem>
                  {brands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Dialog open={brandOpen} onOpenChange={setBrandOpen}>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline" size="icon" aria-label="New brand">
                    <Plus />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New brand</DialogTitle>
                  </DialogHeader>
                  <Input
                    value={newBrand}
                    onChange={(e) => setNewBrand(e.target.value)}
                    placeholder="e.g. Anchor"
                    autoFocus
                  />
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setBrandOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="button" onClick={handleCreateBrand}>
                      Add brand
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="unit">Unit * (how you sell it)</Label>
            <Select value={values.unit_id} onValueChange={(value) => set('unit_id', value)}>
              <SelectTrigger id="unit">
                <SelectValue placeholder="Choose a unit" />
              </SelectTrigger>
              <SelectContent>
                {units.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>
                    {unit.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Supplier (optional)</Label>
            <Select value={values.supplier_id} onValueChange={(value) => set('supplier_id', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Who usually supplies this?" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No supplier</SelectItem>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.company || supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rack">Rack / location</Label>
            <Input
              id="rack"
              value={values.rack}
              onChange={(e) => set('rack', e.target.value)}
              placeholder="e.g. Rack A3"
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={values.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Anything useful to remember about this product"
            />
          </div>
        </CardContent>
      </Card>

      {/* ---------- Pricing ---------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prices</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="purchase_price">Purchase price (Rs.) *</Label>
            <Input
              id="purchase_price"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={values.purchase_price}
              onChange={(e) => set('purchase_price', e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="selling_price">Selling price (Rs.) *</Label>
            <Input
              id="selling_price"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={values.selling_price}
              onChange={(e) => set('selling_price', e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wholesale_price">Wholesale price (Rs.)</Label>
            <Input
              id="wholesale_price"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={values.wholesale_price}
              onChange={(e) => set('wholesale_price', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tax_rate">Tax / VAT (%)</Label>
            <Input
              id="tax_rate"
              type="number"
              min="0"
              max="100"
              step="0.5"
              inputMode="decimal"
              value={values.tax_rate}
              onChange={(e) => set('tax_rate', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* ---------- Stock ---------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stock</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {!product && (
            <div className="space-y-2">
              <Label htmlFor="opening_stock">Opening stock</Label>
              <Input
                id="opening_stock"
                type="number"
                min="0"
                step="0.001"
                inputMode="decimal"
                value={values.opening_stock}
                onChange={(e) => set('opening_stock', e.target.value)}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                How many you already have. Saved with today&apos;s date as an opening entry.
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="min_stock">Minimum stock (alert me at)</Label>
            <Input
              id="min_stock"
              type="number"
              min="0"
              step="0.001"
              inputMode="decimal"
              value={values.min_stock}
              onChange={(e) => set('min_stock', e.target.value)}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">
              Low Stock means the product has reached this quantity.
            </p>
          </div>
          <div className="flex items-end pb-2">
            <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
              <Switch
                checked={values.is_active}
                onCheckedChange={(checked) => set('is_active', checked)}
              />
              Active (visible and sellable)
            </label>
          </div>
        </CardContent>
      </Card>

      {/* ---------- Photo ---------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Photo (optional)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          {values.image_url ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={values.image_url}
                alt="Product photo"
                className="h-24 w-24 rounded-lg border object-cover"
              />
              <button
                type="button"
                onClick={() => set('image_url', '')}
                className="absolute -top-2 -right-2 rounded-full border bg-background p-1 shadow"
                aria-label="Remove photo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : null}
          <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg border px-5 text-base font-medium hover:bg-muted">
            {imageUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" data-icon="inline-start" />
            ) : (
              <Upload className="h-4 w-4" data-icon="inline-start" />
            )}
            {values.image_url ? 'Change photo' : 'Upload photo'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              disabled={imageUploading}
              onChange={(e) => void handleImage(e.target.files?.[0])}
            />
          </label>
          <p className="text-xs text-muted-foreground">JPG, PNG or WEBP · up to 2 MB</p>
        </CardContent>
      </Card>

      {/* ---------- Save ---------- */}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={pending || imageUploading}>
          {pending ? (
            <Loader2 className="animate-spin" data-icon="inline-start" />
          ) : (
            <Save data-icon="inline-start" />
          )}
          {product ? 'Save Changes' : 'Add Product'}
        </Button>
        <Button type="button" variant="outline" size="lg" asChild>
          <Link href={product ? `/products/${product.id}` : '/products'}>
            Cancel
          </Link>
        </Button>
      </div>
    </form>
  );
}
