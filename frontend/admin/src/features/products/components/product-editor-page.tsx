import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye, ImagePlus, LoaderCircle, PackagePlus, Save, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { SimpleCombobox } from "@/components/simple-combobox";
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
import { productService, resolveProductImageUrl, type ProductUnitConversionInput } from "@/services/product.service";
import { IMAGE_FILE_ACCEPT, isSupportedImageFile, MAXIMUM_IMAGE_FILE_SIZE } from "@/lib/image-files";
import { useI18n } from "@/i18n/i18n-provider";
import { CustomerPricingFields, activePriceInputs, createCustomerPriceDrafts, validatePriceDrafts, type CustomerPriceDraft } from "./customer-pricing-fields";
import { ProductUnitConversionsFields, validateUnitConversions } from "./product-unit-conversions-fields";

const empty = { name: "", barcode: "", strength: "", shortDescription: "", description: "", slug: "", categoryId: 0, brandId: null as number | null, unitId: null as number | null, minimumValue: null as number | null, maximumValue: null as number | null, orderQuantityStep: 1, minimumStockQuantity: 0, usesDisplayStock: false, displayStockQuantity: null as number | null, isFeatured: false, isActive: true };

export function ProductEditorPage() {
  const params = useParams();
  const id = params.id ? Number(params.id) : null;
  const editing = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { user } = useAdminAuth();
  const canManagePricing = hasPermission(user, Permissions.ProductPricingManage);
  const { data: lookups, isLoading: lookupsLoading } = useProductLookupsQuery();
  const { data: product, isLoading: productLoading } = useQuery({ queryKey: productKeys.detail(id ?? 0), queryFn: async () => (await productService.getById(id!)).data, enabled: editing });
  const [form, setForm] = useState(empty);
  const [image, setImage] = useState<File | null>(null);
  const [prices, setPrices] = useState<CustomerPriceDraft[]>([]);
  const [unitConversions, setUnitConversions] = useState<ProductUnitConversionInput[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!product) return;
    setForm({ name: product.name, barcode: product.barcode ?? "", strength: product.strength ?? "", shortDescription: product.shortDescription ?? "", description: product.description ?? "", slug: product.slug ?? "", categoryId: product.categoryId, brandId: product.brandId, unitId: product.unitId, minimumValue: product.minimumValue, maximumValue: product.maximumValue, orderQuantityStep: product.orderQuantityStep || 1, minimumStockQuantity: product.inventory?.minimumQuantity ?? 0, usesDisplayStock: product.usesDisplayStock, displayStockQuantity: product.displayStockQuantity, isFeatured: product.isFeatured, isActive: product.isActive });
    setUnitConversions(product.unitConversions.filter(unit => !unit.isBaseUnit).map(unit => ({
      id: unit.id,
      unitId: unit.unitId,
      conversionFactor: unit.conversionFactor,
      barcode: unit.barcode,
      priceOverride: unit.priceOverride,
      oldPriceOverride: unit.oldPriceOverride,
      orderQuantityStep: unit.orderQuantityStep || 1,
      isDefault: unit.isDefault,
      isActive: unit.isActive,
      sortOrder: unit.sortOrder,
    })));
  }, [product]);

  useEffect(() => {
    if (!lookups) return;
    setPrices(createCustomerPriceDrafts(
      lookups.customerTypes,
      lookups.defaultCustomerTypeId,
      product?.prices.map(price => ({ ...price, enabled: true })) ?? [],
    ));
  }, [lookups, product]);

  const preview = useMemo(() => image ? URL.createObjectURL(image) : resolveProductImageUrl(product?.images.find(x => x.isPrimary)?.url), [image, product]);
  useEffect(() => () => { if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview); }, [preview]);

  const selectPrimaryImage = (file: File | null) => {
    if (!file) return;
    if (!isSupportedImageFile(file)) {
      toast.error("Choose a JPG, PNG, WebP, or AVIF image.");
      return;
    }
    if (file.size > MAXIMUM_IMAGE_FILE_SIZE) {
      toast.error("The product image cannot be larger than 5 MB.");
      return;
    }
    setImage(file);
  };

  const save = async () => {
    if (!form.name.trim() || !form.categoryId) return toast.error("Product name and category are required.");
    if (form.minimumValue != null && form.minimumValue < 0) return toast.error("Minimum value cannot be negative.");
    if (form.maximumValue != null && form.maximumValue < 0) return toast.error("Maximum value cannot be negative.");
    if (!Number.isFinite(form.orderQuantityStep) || form.orderQuantityStep <= 0) return toast.error("Cart quantity step must be greater than zero.");
    if (form.minimumStockQuantity < 0) return toast.error("Reorder point cannot be negative.");
    if (form.minimumValue != null && form.maximumValue != null && form.minimumValue > form.maximumValue) return toast.error("Maximum value must be at least the minimum value.");
    if (form.usesDisplayStock && form.displayStockQuantity == null) return toast.error("Enter the quantity customers should see.");
    if (form.displayStockQuantity != null && form.displayStockQuantity < 0) return toast.error("Display quantity cannot be negative.");
    const unitError = validateUnitConversions(form.unitId, unitConversions);
    if (unitError) return toast.error(t(unitError));
    const activePrices = activePriceInputs(prices);
    const pricingError = canManagePricing ? validatePriceDrafts(prices) : null;
    if (pricingError) return toast.error(pricingError);
    if (!editing && !image) return toast.error("A primary product image is required.");
    setSaving(true);
    try {
      let productId = id;
      if (editing && product) {
        await productService.bulkUpdate([{ id: product.id, ...form, primaryImageUrl: product.images.find(x => x.isPrimary)?.url ?? null, images: product.images.map(x => ({ id: x.id, url: x.url, isPrimary: x.isPrimary, sortOrder: x.sortOrder })), image: image ?? undefined, prices: canManagePricing ? activePrices : product.prices, unitConversions }]);
      } else {
        const created = await productService.createSingle({ ...form, image: image!, galleryImages: [], prices: activePrices, unitConversions });
        productId = created.data.products[0]?.id ?? null;
      }
      if (!productId) throw new Error("The product was saved but no product id was returned.");
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
  if (editing && !product) return <div className="space-y-4"><PageHeader title="Product not found" description="The requested product is unavailable or has been removed." /><Button onClick={() => navigate("/products")}><ArrowLeft className="me-2 size-4" />Back to products</Button></div>;

  return <div className="space-y-6">
    <PageHeader title={editing ? "Edit product" : "Create product"} description="Manage catalog details and every customer-type price in one easy form." actions={<div className="flex gap-2"><Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? <LoaderCircle className="me-2 size-4 animate-spin" /> : <Save className="me-2 size-4" />}{editing ? "Save changes" : "Create product"}</Button></div>} />
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,.65fr)]">
      <div className="space-y-6">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><PackagePlus className="size-5" />Product information</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Product name *"><Input value={form.name} onChange={e => setForm(x => ({ ...x, name: e.target.value }))} /></Field>
          <Field label="Barcode"><Input value={form.barcode} onChange={e => setForm(x => ({ ...x, barcode: e.target.value }))} /></Field>
          <Field label={t("products.strength")}><Input value={form.strength} onChange={e => setForm(x => ({ ...x, strength: e.target.value }))} placeholder={t("products.strengthPlaceholder")} /></Field>
          <Field label="Category *"><SimpleCombobox<number> value={form.categoryId || null} onValueChange={(value) => setForm((x) => ({ ...x, categoryId: value ?? 0 }))} options={(lookups?.categories ?? []).map((option) => ({ value: option.id, label: option.name }))} placeholder="Select category" /></Field>
          <Field label="Brand"><SimpleCombobox<number> value={form.brandId} onValueChange={(value) => setForm((x) => ({ ...x, brandId: value }))} options={(lookups?.brands ?? []).map((option) => ({ value: option.id, label: option.name }))} placeholder="No brand" /></Field>
          <Field label={t("productUnits.baseUnit")}><SimpleCombobox<number> value={form.unitId} onValueChange={(value) => setForm((x) => ({ ...x, unitId: value }))} options={(lookups?.units ?? []).map((option) => ({ value: option.id, label: option.name }))} placeholder="Select base unit" /></Field>
          <Field label="Slug"><Input value={form.slug} onChange={e => setForm(x => ({ ...x, slug: e.target.value }))} placeholder="Generated automatically when empty" /></Field>
          <Field label="Minimum value"><Input type="number" min={0} value={form.minimumValue ?? ""} onChange={e => setForm(x => ({ ...x, minimumValue: e.target.value ? Number(e.target.value) : null }))} /></Field>
          <Field label="Maximum value"><Input type="number" min={0} value={form.maximumValue ?? ""} onChange={e => setForm(x => ({ ...x, maximumValue: e.target.value ? Number(e.target.value) : null }))} /></Field>
          <Field label={t("productUnits.baseOrderStep")}><Input type="number" min="0.001" step="any" value={form.orderQuantityStep} onChange={e => setForm(x => ({ ...x, orderQuantityStep: e.target.value === "" ? 0 : Number(e.target.value) }))} /><p className="text-xs leading-5 text-muted-foreground">{t("productUnits.baseOrderStepHelp")}</p></Field>
          <Field label={t("inventory.reorderPoint")}><Input type="number" min={0} step="0.001" value={form.minimumStockQuantity} onChange={e => setForm(x => ({ ...x, minimumStockQuantity: e.target.value === "" ? 0 : Number(e.target.value) }))} /><p className="text-xs leading-5 text-muted-foreground">{t("inventory.reorderHelp")}</p></Field>
          <div className="md:col-span-2 rounded-xl border border-primary/20 bg-primary/[0.035] p-4">
            <label className="flex cursor-pointer items-start justify-between gap-4">
              <span className="flex min-w-0 gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Eye className="size-5" /></span>
                <span><strong className="block text-sm">Display stock</strong><span className="mt-1 block text-xs leading-5 text-muted-foreground">Show a customer-facing quantity without reserving or reducing physical inventory.</span></span>
              </span>
              <Checkbox checked={form.usesDisplayStock} onCheckedChange={value => setForm(current => ({ ...current, usesDisplayStock: value === true, displayStockQuantity: value === true ? current.displayStockQuantity : null }))} />
            </label>
            {form.usesDisplayStock ? <div className="mt-4 grid gap-2 border-t border-primary/10 pt-4 sm:grid-cols-[minmax(0,260px)_1fr] sm:items-end">
              <Field label="Customer-visible quantity *"><Input type="number" min={0} step="any" value={form.displayStockQuantity ?? ""} onChange={event => setForm(current => ({ ...current, displayStockQuantity: event.target.value === "" ? null : Number(event.target.value) }))} placeholder="For example: 250" /></Field>
              <p className="pb-2 text-xs leading-5 text-muted-foreground">Customers can order up to this amount. Orders stay in the normal order workflow, but stock reservations and inventory valuation are not changed.</p>
            </div> : null}
          </div>
          <div className="md:col-span-2"><Field label="Short description"><Textarea value={form.shortDescription} onChange={e => setForm(x => ({ ...x, shortDescription: e.target.value }))} rows={2} /></Field></div>
          <div className="md:col-span-2"><Field label="Full description"><Textarea value={form.description} onChange={e => setForm(x => ({ ...x, description: e.target.value }))} rows={6} /></Field></div>
          <label className="flex items-center gap-3 rounded-lg border p-3"><Checkbox checked={form.isActive} onCheckedChange={v => setForm(x => ({ ...x, isActive: v === true }))} /><span><strong className="block text-sm">Active product</strong><span className="text-xs text-muted-foreground">Visible and available for sale.</span></span></label>
          <label className="flex items-center gap-3 rounded-lg border p-3"><Checkbox checked={form.isFeatured} onCheckedChange={v => setForm(x => ({ ...x, isFeatured: v === true }))} /><span><strong className="block text-sm">Featured product</strong><span className="text-xs text-muted-foreground">Highlight it on the storefront.</span></span></label>
        </CardContent></Card>

        <ProductUnitConversionsFields
          baseUnitId={form.unitId}
          units={lookups?.units ?? []}
          value={unitConversions}
          onChange={setUnitConversions}
          disabled={saving}
        />

        <CustomerPricingFields prices={prices} onChange={setPrices} disabled={!canManagePricing} />
      </div>
      <Card className="h-fit xl:sticky xl:top-20"><CardHeader><CardTitle className="flex items-center gap-2"><ImagePlus className="size-5" />Primary image</CardTitle></CardHeader><CardContent className="space-y-4">
        <label className="block cursor-pointer overflow-hidden rounded-xl border border-dashed bg-muted/30">
          {preview ? <img src={preview} alt="Product preview" className="aspect-square w-full object-cover" /> : <div className="grid aspect-square place-items-center text-center text-sm text-muted-foreground"><span><ImagePlus className="mx-auto mb-2 size-8" />Choose a product image</span></div>}
          <input className="sr-only" type="file" accept={IMAGE_FILE_ACCEPT} onChange={event => { selectPrimaryImage(event.target.files?.[0] ?? null); event.target.value = ""; }} />
        </label>
        {image ? <div className="flex items-center justify-between gap-3 rounded-lg border bg-primary/5 px-3 py-2 text-xs"><span className="min-w-0 truncate font-medium">New image: {image.name}</span><Button type="button" size="icon-xs" variant="ghost" aria-label="Cancel image replacement" onClick={() => setImage(null)}><X className="size-3" /></Button></div> : null}
        <p className="text-xs text-muted-foreground">JPG, PNG, WebP, or AVIF up to 5 MB. In edit mode, leave this unchanged to keep the current image.</p>
      </CardContent></Card>
    </div>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
