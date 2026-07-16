import { useMemo, useState } from "react";
import { ArrowLeft, Barcode, Boxes, CalendarDays, Eye, ImageIcon, PackageCheck, Star } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { useProduct } from "@/features/products/hooks/use-products";
import { resolveProductImageUrl } from "@/services/product.service";
import { useI18n } from "@/i18n/i18n-provider";

const formatNumber = (value: number | null | undefined) => value == null ? "—" : value.toLocaleString();

export default function ProductDetailsPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { t, language } = useI18n();
    const productId = Number(id);
    const { data: product, isLoading, isError } = useProduct(productId);
    const images = useMemo(() => product?.images ?? [], [product]);
    const primary = images.find(image => image.isPrimary) ?? images[0];
    const [selectedImageId, setSelectedImageId] = useState<number | null>(null);
    const selectedImage = images.find(image => image.id === selectedImageId) ?? primary;

    if (isLoading) return <div className="space-y-6"><Skeleton className="h-16 w-full" /><div className="grid gap-6 lg:grid-cols-2"><Skeleton className="aspect-square" /><Skeleton className="h-[32rem]" /></div></div>;
    if (isError || !product) return <div className="space-y-4"><PageHeader title={t("details.notFound")} description={t("details.notFoundHelp")} /><Button variant="outline" onClick={() => navigate("/products")}><ArrowLeft className="me-2 size-4 rtl:rotate-180" />{t("details.back")}</Button></div>;

    const date = (value: string | null) => value ? new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
    const inventory = product.inventory;

    return <div className="space-y-6">
        <PageHeader title={product.name} description={product.shortDescription || t("details.subtitle")} actions={<Button variant="outline" onClick={() => navigate("/products")}><ArrowLeft className="me-2 size-4 rtl:rotate-180" />{t("details.back")}</Button>} />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,.95fr)]">
            <Card className="overflow-hidden"><CardContent className="p-0">
                <div className="flex aspect-[4/3] items-center justify-center border-b bg-muted/30">
                    {selectedImage ? <img src={resolveProductImageUrl(selectedImage.url)!} alt={product.name} className="size-full object-contain" /> : <ImageIcon className="size-16 text-muted-foreground/40" />}
                </div>
                {images.length > 1 && <div className="grid grid-cols-5 gap-2 p-4 sm:grid-cols-7">{images.map(image => <button key={image.id} type="button" onClick={() => setSelectedImageId(image.id)} className={`aspect-square overflow-hidden border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selectedImage?.id === image.id ? "ring-2 ring-primary" : "opacity-75 hover:opacity-100"}`}><img src={resolveProductImageUrl(image.url)!} alt="" className="size-full object-cover" /></button>)}</div>}
            </CardContent></Card>

            <div className="space-y-6">
                <Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-2xl">{product.name}</CardTitle><p className="mt-2 font-mono text-xs text-muted-foreground">{product.slug ? `/${product.slug}` : "—"}</p></div><div className="flex gap-2"><Badge variant={product.isActive ? "outline" : "secondary"}>{product.isActive ? t("products.active") : t("products.inactive")}</Badge>{product.isFeatured && <Badge><Star className="me-1 size-3 fill-current" />{t("details.featured")}</Badge>}</div></div></CardHeader>
                    <CardContent className="space-y-5"><p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{product.description || product.shortDescription || t("details.noDescription")}</p><div className="grid gap-3 sm:grid-cols-2"><Detail icon={Barcode} label={t("products.barcode")} value={product.barcode || "—"} /><Detail icon={Boxes} label={t("products.category")} value={product.categoryName} /><Detail label={t("form.brand")} value={product.brandName || "—"} /><Detail label={t("form.unit")} value={product.unitName || "—"} /><Detail icon={Eye} label={t("details.views")} value={formatNumber(product.viewCount)} /><Detail icon={CalendarDays} label={t("details.created")} value={date(product.createdAt)} /></div></CardContent>
                </Card>
                <div className="grid gap-4 sm:grid-cols-2"><Metric label={t("details.availableStock")} value={formatNumber(inventory?.availableQuantity)} icon={PackageCheck} /><Metric label={t("details.reservedStock")} value={formatNumber(inventory?.reservedQuantity)} icon={Boxes} /></div>
            </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
            <Card><CardHeader><CardTitle>{t("details.inventory")}</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><Detail label={t("details.totalStock")} value={formatNumber(inventory?.quantity)} /><Detail label={t("details.availableStock")} value={formatNumber(inventory?.availableQuantity)} /><Detail label={t("details.reservedStock")} value={formatNumber(inventory?.reservedQuantity)} /><Detail label={t("details.minimumStock")} value={formatNumber(inventory?.minimumQuantity)} /><Detail label={t("details.expiry")} value={inventory?.expireDate || "—"} /><Detail label={t("details.updated")} value={date(product.updatedAt)} /></CardContent></Card>
            <Card><CardHeader><CardTitle>{t("details.pricing")}</CardTitle></CardHeader><CardContent>{product.prices.length === 0 ? <p className="text-sm text-muted-foreground">{t("details.noPrices")}</p> : <div className="divide-y border">{product.prices.map(price => <div key={price.id} className="grid grid-cols-3 gap-3 p-3 text-sm"><span className="font-medium">{price.customerTypeName}</span><span>{formatNumber(price.regularPrice)}</span><span className="text-primary">{formatNumber(price.salePrice)}</span></div>)}</div>}</CardContent></Card>
        </div>
    </div>;
}

function Detail({ icon: Icon, label, value }: { icon?: typeof Barcode; label: string; value: string }) { return <div className="flex gap-3 border p-3">{Icon && <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}<div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 truncate text-sm font-medium">{value}</p></div></div>; }
function Metric({ icon: Icon, label, value }: { icon: typeof Boxes; label: string; value: string }) { return <Card><CardContent className="flex items-center gap-4 p-5"><div className="border bg-primary/5 p-3 text-primary"><Icon className="size-5" /></div><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div></CardContent></Card>; }
