import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BadgeDollarSign, ImagePlus, LoaderCircle, PackagePlus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAdminAuth } from "@/features/auth/auth-context";
import { hasPermission, Permissions } from "@/features/auth/permissions";
import { useProductLookupsQuery } from "@/features/products/hooks/use-product-mutation";
import { productKeys } from "@/keys/product-keys";
import { productService, resolveProductImageUrl, type ProductPriceInput } from "@/services/product.service";

interface PriceDraft extends ProductPriceInput { customerTypeName: string; isDefault: boolean; enabled: boolean }
const empty = { name: "", barcode: "", shortDescription: "", description: "", slug: "", categoryId: 0, brandId: null as number | null, unitId: null as number | null, minimumValue: null as number | null, maximumValue: null as number | null, isFeatured: false, isActive: true };

export function ProductEditorPage() {
  const params = useParams();
  const id = params.id ? Number(params.id) : null;
  const editing = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAdminAuth();
  const canManagePricing = hasPermission(user, Permissions.ProductPricingManage);
  const { data: lookups, isLoading: lookupsLoading } = useProductLookupsQuery();
  const { data: product, isLoading: productLoading } = useQuery({ queryKey: productKeys.detail(id ?? 0), queryFn: async () => (await productService.getById(id!)).data, enabled: editing });
  const [form, setForm] = useState(empty);
  const [image, setImage] = useState<File | null>(null);
  const [prices, setPrices] = useState<PriceDraft[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!product) return;
    setForm({ name: product.name, barcode: product.barcode ?? "", shortDescription: product.shortDescription ?? "", description: product.description ?? "", slug: product.slug ?? "", categoryId: product.categoryId, brandId: product.brandId, unitId: product.unitId, minimumValue: product.minimumValue, maximumValue: product.maximumValue, isFeatured: product.isFeatured, isActive: product.isActive });
  }, [product]);

  useEffect(() => {
    if (!lookups) return;
    setPrices(lookups.customerTypes.map(type => {
      const existing = product?.prices.find(price => price.customerTypeId === type.id);
      return { id: existing?.id, customerTypeId: type.id, customerTypeName: type.name, regularPrice: existing?.regularPrice ?? 0, salePrice: existing?.salePrice ?? null, startDate: existing?.startDate ?? null, endDate: existing?.endDate ?? null, isDefault: type.id === lookups.defaultCustomerTypeId, enabled: Boolean(existing) || type.id === lookups.defaultCustomerTypeId };
    }));
  }, [lookups, product]);

  const preview = useMemo(() => image ? URL.createObjectURL(image) : resolveProductImageUrl(product?.images.find(x => x.isPrimary)?.url), [image, product]);
  useEffect(() => () => { if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview); }, [preview]);

  const save = async () => {
    if (!form.name.trim() || !form.categoryId) return toast.error("Product name and category are required.");
    if (form.minimumValue != null && form.minimumValue < 0) return toast.error("Minimum value cannot be negative.");
    if (form.maximumValue != null && form.maximumValue < 0) return toast.error("Maximum value cannot be negative.");
    if (form.minimumValue != null && form.maximumValue != null && form.minimumValue > form.maximumValue) return toast.error("Maximum value must be at least the minimum value.");
    const activePrices = prices.filter(price => price.enabled).map(price => ({
      id: price.id,
      customerTypeId: price.customerTypeId,
      regularPrice: Number(price.regularPrice),
      salePrice: price.salePrice == null ? null : Number(price.salePrice),
      startDate: price.startDate,
      endDate: price.endDate,
    }));
    const defaultPrice = prices.find(x => x.isDefault);
    if (canManagePricing && (!defaultPrice?.enabled || Number(defaultPrice.regularPrice) < 0)) return toast.error("A valid default customer price is required.");
    if (canManagePricing && activePrices.some(x => x.regularPrice < 0 || (x.salePrice != null && (x.salePrice < 0 || x.salePrice >= x.regularPrice)))) return toast.error("Prices must be non-negative and sale price must be lower than regular price.");
    if (canManagePricing && activePrices.some(x => x.startDate && x.endDate && x.endDate < x.startDate)) return toast.error("A sale end date cannot be earlier than its start date.");
    if (!editing && !image) return toast.error("A primary product image is required.");
    setSaving(true);
    try {
      let productId = id;
      if (editing && product) {
        await productService.bulkUpdate([{ id: product.id, ...form, primaryImageUrl: product.images.find(x => x.isPrimary)?.url ?? null, images: product.images.map(x => ({ id: x.id, url: x.url, isPrimary: x.isPrimary, sortOrder: x.sortOrder })), image: image ?? undefined }]);
      } else {
        const created = await productService.createSingle({ ...form, image: image!, galleryImages: [] });
        productId = created.data.products[0]?.id ?? null;
      }
      if (!productId) throw new Error("The product was saved but no product id was returned.");
      if (canManagePricing) await productService.replacePrices(productId, activePrices);
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      toast.success(canManagePricing
        ? (editing ? "Product and customer prices updated." : "Product and customer prices created.")
        : (editing ? "Product updated." : "Product created."));
      navigate(`/products/${productId}`);
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string; errors?: Record<string, string[]> } }; message?: string }).response?.data;
      toast.error(message?.errors ? Object.values(message.errors).flat()[0] : message?.message ?? (error as Error).message ?? "Could not save product.");
    } finally { setSaving(false); }
  };

  if (lookupsLoading || productLoading) return <div className="grid min-h-[50vh] place-items-center"><LoaderCircle className="size-7 animate-spin" /></div>;
  if (editing && !product) return <div className="space-y-4"><PageHeader title="Product not found" /><Button onClick={() => navigate("/products")}><ArrowLeft className="me-2 size-4" />Back to products</Button></div>;

  return <div className="space-y-6">
    <PageHeader title={editing ? "Edit product" : "Create product"} description="Manage catalog details and every customer-type price in one easy form." actions={<div className="flex gap-2"><Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? <LoaderCircle className="me-2 size-4 animate-spin" /> : <Save className="me-2 size-4" />}{editing ? "Save changes" : "Create product"}</Button></div>} />
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,.65fr)]">
      <div className="space-y-6">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><PackagePlus className="size-5" />Product information</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Product name *"><Input value={form.name} onChange={e => setForm(x => ({ ...x, name: e.target.value }))} /></Field>
          <Field label="Barcode"><Input value={form.barcode} onChange={e => setForm(x => ({ ...x, barcode: e.target.value }))} /></Field>
          <Field label="Category *"><Select value={form.categoryId} onChange={value => setForm(x => ({ ...x, categoryId: value }))} options={lookups?.categories ?? []} placeholder="Select category" /></Field>
          <Field label="Brand"><Select value={form.brandId ?? 0} onChange={value => setForm(x => ({ ...x, brandId: value || null }))} options={lookups?.brands ?? []} placeholder="No brand" /></Field>
          <Field label="Unit"><Select value={form.unitId ?? 0} onChange={value => setForm(x => ({ ...x, unitId: value || null }))} options={lookups?.units ?? []} placeholder="No unit" /></Field>
          <Field label="Slug"><Input value={form.slug} onChange={e => setForm(x => ({ ...x, slug: e.target.value }))} placeholder="Generated automatically when empty" /></Field>
          <Field label="Minimum value"><Input type="number" min={0} value={form.minimumValue ?? ""} onChange={e => setForm(x => ({ ...x, minimumValue: e.target.value ? Number(e.target.value) : null }))} /></Field>
          <Field label="Maximum value"><Input type="number" min={0} value={form.maximumValue ?? ""} onChange={e => setForm(x => ({ ...x, maximumValue: e.target.value ? Number(e.target.value) : null }))} /></Field>
          <div className="md:col-span-2"><Field label="Short description"><Textarea value={form.shortDescription} onChange={e => setForm(x => ({ ...x, shortDescription: e.target.value }))} rows={2} /></Field></div>
          <div className="md:col-span-2"><Field label="Full description"><Textarea value={form.description} onChange={e => setForm(x => ({ ...x, description: e.target.value }))} rows={6} /></Field></div>
          <label className="flex items-center gap-3 rounded-lg border p-3"><Checkbox checked={form.isActive} onCheckedChange={v => setForm(x => ({ ...x, isActive: v === true }))} /><span><strong className="block text-sm">Active product</strong><span className="text-xs text-muted-foreground">Visible and available for sale.</span></span></label>
          <label className="flex items-center gap-3 rounded-lg border p-3"><Checkbox checked={form.isFeatured} onCheckedChange={v => setForm(x => ({ ...x, isFeatured: v === true }))} /><span><strong className="block text-sm">Featured product</strong><span className="text-xs text-muted-foreground">Highlight it on the storefront.</span></span></label>
        </CardContent></Card>

        <Card><CardHeader><CardTitle className="flex items-center gap-2"><BadgeDollarSign className="size-5" />Customer-type pricing</CardTitle></CardHeader><CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{canManagePricing ? "Enable the customer groups that need their own price. The default row is always required for guests and general customers." : "You can view customer pricing, but your role does not have permission to change it."}</p>
          {prices.map((price, index) => <div key={price.customerTypeId} className="grid gap-3 rounded-xl border p-4 md:grid-cols-[180px_1fr_1fr_1fr_1fr_auto] md:items-end">
            <label className="flex items-center gap-2 pb-2"><Checkbox checked={price.enabled} disabled={price.isDefault || !canManagePricing} onCheckedChange={v => setPrices(rows => rows.map((row, i) => i === index ? { ...row, enabled: v === true } : row))} /><span className="text-sm font-medium">{price.customerTypeName}</span>{price.isDefault && <Badge>Default</Badge>}</label>
            <Field label="Regular price"><Input type="number" min={0} step="0.01" disabled={!price.enabled || !canManagePricing} value={price.regularPrice} onChange={e => setPrices(rows => rows.map((row, i) => i === index ? { ...row, regularPrice: Number(e.target.value) } : row))} /></Field>
            <Field label="Sale price"><Input type="number" min={0} step="0.01" disabled={!price.enabled || !canManagePricing} value={price.salePrice ?? ""} onChange={e => setPrices(rows => rows.map((row, i) => i === index ? { ...row, salePrice: e.target.value ? Number(e.target.value) : null } : row))} /></Field>
            <Field label="Sale starts"><Input type="date" disabled={!price.enabled || price.salePrice == null || !canManagePricing} value={price.startDate ?? ""} onChange={e => setPrices(rows => rows.map((row, i) => i === index ? { ...row, startDate: e.target.value || null } : row))} /></Field>
            <Field label="Sale ends"><Input type="date" disabled={!price.enabled || price.salePrice == null || !canManagePricing} value={price.endDate ?? ""} onChange={e => setPrices(rows => rows.map((row, i) => i === index ? { ...row, endDate: e.target.value || null } : row))} /></Field>
            {!price.isDefault && <Button type="button" size="icon" variant="ghost" disabled={!price.enabled || !canManagePricing} onClick={() => setPrices(rows => rows.map((row, i) => i === index ? { ...row, enabled: false } : row))}><Trash2 className="size-4 text-destructive" /></Button>}
          </div>)}
        </CardContent></Card>
      </div>
      <Card className="h-fit xl:sticky xl:top-20"><CardHeader><CardTitle className="flex items-center gap-2"><ImagePlus className="size-5" />Primary image</CardTitle></CardHeader><CardContent className="space-y-4">
        <label className="block cursor-pointer overflow-hidden rounded-xl border border-dashed bg-muted/30">
          {preview ? <img src={preview} alt="Product preview" className="aspect-square w-full object-cover" /> : <div className="grid aspect-square place-items-center text-center text-sm text-muted-foreground"><span><ImagePlus className="mx-auto mb-2 size-8" />Choose a product image</span></div>}
          <input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setImage(e.target.files?.[0] ?? null)} />
        </label>
        <p className="text-xs text-muted-foreground">JPG, PNG, or WebP. In edit mode, leave this unchanged to keep the current image.</p>
      </CardContent></Card>
    </div>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
function Select({ value, onChange, options, placeholder }: { value: number; onChange: (value: number) => void; options: { id: number; name: string }[]; placeholder: string }) { return <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={value} onChange={e => onChange(Number(e.target.value))}><option value={0}>{placeholder}</option>{options.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select>; }
