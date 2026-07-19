import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
    AlertTriangle,
    ArrowDownRight,
    ArrowUpRight,
    Boxes,
    CalendarClock,
    CheckCircle2,
    Eye,
    History,
    LoaderCircle,
    PackageCheck,
    PackageSearch,
    RefreshCw,
    Search,
    Settings2,
    SlidersHorizontal,
    Warehouse,
    X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox, ComboboxContent, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { InventoryAdjustDialog } from "@/features/inventory/components/inventory-adjust-dialog";
import { InventorySettingsDialog } from "@/features/inventory/components/inventory-settings-dialog";
import { inventoryKeys, useInventoryOverview, useInventoryTransactions } from "@/features/inventory/hooks/use-inventory";
import type {
    InventoryListItem,
    InventoryStatus,
    InventoryTransactionType,
} from "@/features/inventory/types/inventory-types";
import { ProductPagination } from "@/features/products/components/product-pagination";
import { useProductLookupsQuery } from "@/features/products/hooks/use-product-mutation";
import { useI18n } from "@/i18n/i18n-provider";
import { cn } from "@/lib/utils";
import { resolveProductImageUrl } from "@/services/product.service";

type InventoryView = "overview" | "transactions";
type InventorySort = "name" | "quantity" | "available" | "expiry" | "updatedAt";
type TransactionOption = { id: InventoryTransactionType; name: string };
type TransactionFilterOption = { id: InventoryTransactionType | "all"; name: string };

export function InventoryPage() {
    const { t } = useI18n();
    const queryClient = useQueryClient();
    const [view, setView] = useState<InventoryView>("overview");
    const [refreshing, setRefreshing] = useState(false);

    const refresh = async () => {
        setRefreshing(true);
        await queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
        setRefreshing(false);
    };

    return <div className="space-y-6">
        <PageHeader title={t("inventory.title")} description={t("inventory.subtitle")} actions={<Button variant="outline" onClick={refresh} disabled={refreshing}><RefreshCw className={cn("me-2 size-4", refreshing && "animate-spin")} />{t("inventory.refresh")}</Button>} />

        <div className="inline-flex border bg-muted/40 p-1" role="tablist" aria-label={t("inventory.title")}>
            <Button role="tab" aria-selected={view === "overview"} variant={view === "overview" ? "default" : "ghost"} size="sm" onClick={() => setView("overview")}><Warehouse className="me-2 size-4" />{t("inventory.overview")}</Button>
            <Button role="tab" aria-selected={view === "transactions"} variant={view === "transactions" ? "default" : "ghost"} size="sm" onClick={() => setView("transactions")}><History className="me-2 size-4" />{t("inventory.transactions")}</Button>
        </div>

        {view === "overview" ? <InventoryOverview /> : <InventoryTransactions />}
    </div>;
}

function InventoryOverview() {
    const { t } = useI18n();
    const navigate = useNavigate();
    const [search, setSearch] = useState("");
    const debouncedSearch = useDebouncedValue(search, 300);
    const [status, setStatus] = useState<InventoryStatus | undefined>();
    const [categoryId, setCategoryId] = useState<number | undefined>();
    const [sortBy, setSortBy] = useState<InventorySort>("updatedAt");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [adjusting, setAdjusting] = useState<InventoryListItem | null>(null);
    const [editingSettings, setEditingSettings] = useState<InventoryListItem | null>(null);
    const { data: lookups } = useProductLookupsQuery();
    const { data, isLoading, isError, isFetching } = useInventoryOverview({ search: debouncedSearch || undefined, status, categoryId, sortBy, sortDescending: sortBy === "updatedAt", page, pageSize });
    const products = data?.products.items ?? [];
    const hasFilters = Boolean(search || status || categoryId);

    const statusOptions: { id: InventoryStatus | "all"; label: string; count?: number }[] = [
        { id: "all", label: t("inventory.allStock"), count: data?.summary.totalProducts },
        { id: "Healthy", label: t("inventory.healthy"), count: data?.summary.healthyProducts },
        { id: "LowStock", label: t("inventory.lowStock"), count: data?.summary.lowStockProducts },
        { id: "OutOfStock", label: t("inventory.outOfStock"), count: data?.summary.outOfStockProducts },
    ];
    const categories = useMemo(() => [{ id: 0, name: t("inventory.allCategories") }, ...(lookups?.categories ?? [])], [lookups?.categories, t]);
    const selectedCategory = categories.find(option => option.id === (categoryId ?? 0)) ?? categories[0];
    const sortOptions: { id: InventorySort; name: string }[] = [
        { id: "updatedAt", name: t("inventory.sortRecent") },
        { id: "available", name: t("inventory.sortAvailable") },
        { id: "quantity", name: t("inventory.sortOnHand") },
        { id: "expiry", name: t("inventory.sortExpiry") },
        { id: "name", name: t("inventory.sortName") },
    ];
    const selectedSort = sortOptions.find(option => option.id === sortBy) ?? sortOptions[0];

    const clearFilters = () => { setSearch(""); setStatus(undefined); setCategoryId(undefined); setPage(1); };

    return <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard icon={Boxes} label={t("inventory.totalProducts")} value={data?.summary.totalProducts} detail={t("inventory.activeCount").replace("{count}", formatNumber(data?.summary.activeProducts))} />
            <MetricCard icon={PackageCheck} label={t("inventory.availableUnits")} value={data?.summary.availableQuantity} detail={t("inventory.onHandCount").replace("{count}", formatNumber(data?.summary.totalQuantity))} tone="success" />
            <MetricCard icon={Warehouse} label={t("inventory.reservedUnits")} value={data?.summary.reservedQuantity} detail={t("inventory.reservedHelp")} />
            <MetricCard icon={AlertTriangle} label={t("inventory.lowStock")} value={data?.summary.lowStockProducts} detail={t("inventory.expiringCount").replace("{count}", formatNumber(data?.summary.expiringSoonProducts))} tone="warning" />
            <MetricCard icon={PackageSearch} label={t("inventory.outOfStock")} value={data?.summary.outOfStockProducts} detail={t("inventory.needsAttention")} tone="danger" />
        </div>

        <Card>
            <CardHeader className="border-b">
                <CardTitle>{t("inventory.stockCatalog")}</CardTitle>
                <p className="text-xs text-muted-foreground">{t("inventory.stockCatalogHelp")}</p>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
                <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
                    <div className="relative min-w-0 flex-1"><Search className="absolute start-3 top-2.5 size-4 text-muted-foreground" /><Input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} className="ps-9 pe-9" placeholder={t("inventory.search")} />{search && <Button variant="ghost" size="icon-xs" className="absolute end-2 top-1" aria-label={t("filters.clearSearch")} onClick={() => { setSearch(""); setPage(1); }}><X /></Button>}</div>
                    <Combobox items={categories} value={selectedCategory} onValueChange={option => { setCategoryId(option?.id ? option.id : undefined); setPage(1); }} itemToStringLabel={option => option.name}>
                        <ComboboxInput className="w-full xl:w-52" />
                        <ComboboxContent><ComboboxList>{categories.map(option => <ComboboxItem key={option.id} value={option}>{option.name}</ComboboxItem>)}</ComboboxList></ComboboxContent>
                    </Combobox>
                    <Combobox items={sortOptions} value={selectedSort} onValueChange={option => { if (option) { setSortBy(option.id); setPage(1); } }} itemToStringLabel={option => option.name}>
                        <ComboboxInput className="w-full xl:w-48" />
                        <ComboboxContent><ComboboxList>{sortOptions.map(option => <ComboboxItem key={option.id} value={option}>{option.name}</ComboboxItem>)}</ComboboxList></ComboboxContent>
                    </Combobox>
                    {hasFilters && <Button variant="destructive" onClick={clearFilters}><X className="me-2 size-4" />{t("filters.removeAll")}</Button>}
                </div>

                <div className="flex flex-wrap gap-2" aria-label={t("inventory.stockStatus")}>
                    {statusOptions.map(option => <Button key={option.id} variant={(status ?? "all") === option.id ? "secondary" : "outline"} size="sm" onClick={() => { setStatus(option.id === "all" ? undefined : option.id); setPage(1); }}>
                        {option.label}{option.count !== undefined && <span className="ms-2 border bg-background px-1.5 text-[10px] tabular-nums text-foreground">{formatNumber(option.count)}</span>}
                    </Button>)}
                </div>

                <div className="overflow-x-auto border">
                    <Table>
                        <TableHeader><TableRow>
                            <TableHead className="min-w-64">{t("products.product")}</TableHead>
                            <TableHead>{t("inventory.stockStatus")}</TableHead>
                            <TableHead className="text-end">{t("inventory.onHand")}</TableHead>
                            <TableHead className="text-end">{t("inventory.reserved")}</TableHead>
                            <TableHead className="text-end">{t("inventory.available")}</TableHead>
                            <TableHead className="text-end">{t("inventory.reorderPoint")}</TableHead>
                            <TableHead>{t("inventory.expiryDate")}</TableHead>
                            <TableHead className="w-36 text-end">{t("types.actions")}</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                            {isLoading && <LoadingRow colSpan={8} />}
                            {isError && <MessageRow colSpan={8} message={t("inventory.loadError")} destructive />}
                            {!isLoading && !isError && products.length === 0 && <MessageRow colSpan={8} message={t("inventory.empty")} />}
                            {products.map(item => <TableRow key={item.productId} className="group cursor-pointer" onDoubleClick={() => navigate(`/products/${item.productId}`)}>
                                <TableCell><div className="flex items-center gap-3">{resolveProductImageUrl(item.primaryImageUrl) ? <img src={resolveProductImageUrl(item.primaryImageUrl)!} alt="" className="size-10 border bg-muted object-cover" /> : <div className="flex size-10 items-center justify-center border bg-muted"><Boxes className="size-4 text-muted-foreground" /></div>}<div className="min-w-0"><p className="truncate font-medium">{item.name}</p><p className="mt-0.5 truncate text-[11px] text-muted-foreground">{item.barcode || t("inventory.noBarcode")} · {item.categoryName}{item.unitName ? ` · ${item.unitName}` : ""}</p></div></div></TableCell>
                                <TableCell><StockStatusBadge item={item} /></TableCell>
                                <NumberCell value={item.quantity} />
                                <NumberCell value={item.reservedQuantity} muted={item.reservedQuantity === 0} />
                                <TableCell className="text-end"><div className="font-semibold tabular-nums">{formatNumber(item.availableQuantity)}</div><StockLevel available={item.availableQuantity} minimum={item.minimumQuantity} /></TableCell>
                                <NumberCell value={item.minimumQuantity} muted={item.minimumQuantity === 0} />
                                <TableCell><Expiry item={item} /></TableCell>
                                <TableCell onDoubleClick={event => event.stopPropagation()}><div className="flex justify-end gap-1"><Button variant="outline" size="icon-sm" aria-label={t("inventory.adjustStock")} onClick={() => setAdjusting(item)}><SlidersHorizontal className="size-4" /></Button><Button variant="outline" size="icon-sm" aria-label={t("inventory.settingsTitle")} onClick={() => setEditingSettings(item)}><Settings2 className="size-4" /></Button><Button variant="ghost" size="icon-sm" aria-label={t("details.open")} onClick={() => navigate(`/products/${item.productId}`)}><Eye className="size-4" /></Button></div></TableCell>
                            </TableRow>)}
                        </TableBody>
                    </Table>
                </div>

                {data?.products && <ProductPagination page={data.products.page} pageSize={data.products.pageSize} totalCount={data.products.totalCount} totalPages={data.products.totalPages} onPageChange={setPage} onPageSizeChange={size => { setPageSize(size); setPage(1); }} />}
            </CardContent>
        </Card>

        {isFetching && !isLoading && <FetchingNotice text={t("inventory.refreshing")} />}
        <InventoryAdjustDialog item={adjusting} open={Boolean(adjusting)} onOpenChange={open => !open && setAdjusting(null)} />
        <InventorySettingsDialog item={editingSettings} open={Boolean(editingSettings)} onOpenChange={open => !open && setEditingSettings(null)} />
    </div>;
}

function InventoryTransactions() {
    const { t, language } = useI18n();
    const navigate = useNavigate();
    const [search, setSearch] = useState("");
    const debouncedSearch = useDebouncedValue(search, 300);
    const [type, setType] = useState<InventoryTransactionType | undefined>();
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const { data, isLoading, isError, isFetching } = useInventoryTransactions({ search: debouncedSearch || undefined, type, from: from ? `${from}T00:00:00` : undefined, to: to ? `${to}T23:59:59.999` : undefined, page, pageSize });
    const typeOptions = transactionOptions(t);
    const options: TransactionFilterOption[] = [{ id: "all", name: t("inventory.allMovements") }, ...typeOptions];
    const selectedType = options.find(option => option.id === (type ?? "all")) ?? options[0];
    const hasFilters = Boolean(search || type || from || to);
    const locale = language === "en" ? "en-US" : "fa-AF";

    const clear = () => { setSearch(""); setType(undefined); setFrom(""); setTo(""); setPage(1); };

    return <Card>
        <CardHeader className="border-b"><CardTitle>{t("inventory.ledgerTitle")}</CardTitle><p className="text-xs text-muted-foreground">{t("inventory.ledgerHelp")}</p></CardHeader>
        <CardContent className="space-y-4 pt-4">
            <div className="grid gap-2 lg:grid-cols-[minmax(220px,1fr)_220px_160px_160px_auto]">
                <div className="relative"><Search className="absolute start-3 top-2.5 size-4 text-muted-foreground" /><Input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} className="ps-9" placeholder={t("inventory.searchTransactions")} /></div>
                <Combobox items={options} value={selectedType} onValueChange={option => { setType(option?.id === "all" ? undefined : option?.id); setPage(1); }} itemToStringLabel={option => option.name}><ComboboxInput className="w-full" /><ComboboxContent><ComboboxList>{options.map(option => <ComboboxItem key={option.id} value={option}>{option.name}</ComboboxItem>)}</ComboboxList></ComboboxContent></Combobox>
                <Input type="date" aria-label={t("inventory.fromDate")} value={from} onChange={event => { setFrom(event.target.value); setPage(1); }} />
                <Input type="date" aria-label={t("inventory.toDate")} value={to} min={from || undefined} onChange={event => { setTo(event.target.value); setPage(1); }} />
                {hasFilters && <Button variant="destructive" onClick={clear}><X className="me-2 size-4" />{t("filters.removeAll")}</Button>}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground"><span>{t("inventory.fromDate")}: {from || t("filters.all")}</span><span>{t("inventory.toDate")}: {to || t("filters.all")}</span></div>

            <div className="overflow-x-auto border"><Table>
                <TableHeader><TableRow><TableHead>{t("inventory.date")}</TableHead><TableHead className="min-w-56">{t("products.product")}</TableHead><TableHead>{t("inventory.movementType")}</TableHead><TableHead className="text-end">{t("inventory.change")}</TableHead><TableHead className="text-end">{t("inventory.beforeAfter")}</TableHead><TableHead className="min-w-52">{t("inventory.note")}</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                    {isLoading && <LoadingRow colSpan={7} />}
                    {isError && <MessageRow colSpan={7} message={t("inventory.transactionsError")} destructive />}
                    {!isLoading && !isError && (data?.items.length ?? 0) === 0 && <MessageRow colSpan={7} message={t("inventory.noTransactions")} />}
                    {data?.items.map(transaction => <TableRow key={transaction.id}>
                        <TableCell className="whitespace-nowrap text-xs"><p>{new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(transaction.createdAt))}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(new Date(transaction.createdAt))}</p></TableCell>
                        <TableCell><p className="font-medium">{transaction.productName}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{transaction.productBarcode || t("inventory.noBarcode")}</p></TableCell>
                        <TableCell><MovementBadge type={transaction.type} label={typeOptions.find(option => option.id === transaction.type)?.name ?? transaction.type} /></TableCell>
                        <TableCell className={cn("text-end font-semibold tabular-nums", transaction.quantity > 0 ? "text-emerald-600 dark:text-emerald-400" : transaction.quantity < 0 && "text-destructive")}>{transaction.quantity > 0 ? "+" : ""}{formatNumber(transaction.quantity)}</TableCell>
                        <TableCell className="text-end tabular-nums"><span className="text-muted-foreground">{formatNumber(transaction.quantityBefore)}</span><span className="mx-1">→</span><span className="font-medium">{formatNumber(transaction.quantityAfter)}</span></TableCell>
                        <TableCell><p className="line-clamp-2 text-xs">{transaction.description || t("inventory.noNote")}</p>{transaction.referenceId && <p className="mt-1 text-[11px] text-muted-foreground">{transaction.referenceType} #{transaction.referenceId}</p>}</TableCell>
                        <TableCell><Button variant="ghost" size="icon-sm" aria-label={t("details.open")} onClick={() => navigate(`/products/${transaction.productId}`)}><Eye className="size-4" /></Button></TableCell>
                    </TableRow>)}
                </TableBody>
            </Table></div>
            {data && <ProductPagination page={data.page} pageSize={data.pageSize} totalCount={data.totalCount} totalPages={data.totalPages} onPageChange={setPage} onPageSizeChange={size => { setPageSize(size); setPage(1); }} />}
            {isFetching && !isLoading && <FetchingNotice text={t("inventory.refreshing")} />}
        </CardContent>
    </Card>;
}

function MetricCard({ icon: Icon, label, value, detail, tone = "default" }: { icon: typeof Boxes; label: string; value?: number; detail: string; tone?: "default" | "success" | "warning" | "danger" }) {
    const toneClass = { default: "text-primary bg-primary/10", success: "text-emerald-600 bg-emerald-500/10 dark:text-emerald-400", warning: "text-amber-600 bg-amber-500/10 dark:text-amber-400", danger: "text-destructive bg-destructive/10" }[tone];
    return <Card size="sm"><CardContent className="flex items-start justify-between gap-3"><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold tabular-nums">{value === undefined ? "—" : formatNumber(value)}</p><p className="mt-1 text-[11px] text-muted-foreground">{detail}</p></div><span className={cn("flex size-9 shrink-0 items-center justify-center", toneClass)}><Icon className="size-4" /></span></CardContent></Card>;
}

function StockStatusBadge({ item }: { item: InventoryListItem }) {
    const { t } = useI18n();
    if (item.status === "OutOfStock") return <Badge variant="destructive"><PackageSearch className="me-1 size-3" />{t("inventory.outOfStock")}</Badge>;
    if (item.status === "LowStock") return <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300" variant="outline"><AlertTriangle className="me-1 size-3" />{t("inventory.lowStock")}</Badge>;
    return <Badge className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" variant="outline"><CheckCircle2 className="me-1 size-3" />{t("inventory.healthy")}</Badge>;
}

function MovementBadge({ type, label }: { type: InventoryTransactionType; label: string }) {
    const positive = type === "Purchase" || type === "SaleReturn" || type === "ReservationRelease";
    const neutral = type === "Reservation" || type === "Transfer";
    return <Badge variant="outline" className={cn(positive && "border-emerald-500/40 text-emerald-700 dark:text-emerald-300", !positive && !neutral && "border-destructive/40 text-destructive")}>
        {positive ? <ArrowUpRight className="me-1 size-3" /> : <ArrowDownRight className="me-1 size-3" />}{label}
    </Badge>;
}

function StockLevel({ available, minimum }: { available: number; minimum: number }) {
    const denominator = Math.max(minimum * 2, available, 1);
    const percentage = Math.min(100, Math.max(0, available / denominator * 100));
    const color = available <= 0 ? "bg-destructive" : available <= minimum ? "bg-amber-500" : "bg-emerald-500";
    return <div className="ms-auto mt-1 h-1 w-16 overflow-hidden bg-muted"><div className={cn("h-full", color)} style={{ width: `${percentage}%` }} /></div>;
}

function Expiry({ item }: { item: InventoryListItem }) {
    const { t, language } = useI18n();
    if (!item.expireDate) return <span className="text-muted-foreground">—</span>;
    const locale = language === "en" ? "en-US" : "fa-AF";
    return <div className={cn("whitespace-nowrap text-xs", item.isExpiringSoon && "text-amber-600 dark:text-amber-400")}><span className="inline-flex items-center"><CalendarClock className="me-1 size-3.5" />{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${item.expireDate}T00:00:00Z`))}</span>{item.isExpiringSoon && <p className="mt-0.5 text-[10px] font-medium">{t("inventory.expiringSoon")}</p>}</div>;
}

function NumberCell({ value, muted = false }: { value: number; muted?: boolean }) {
    return <TableCell className={cn("text-end font-medium tabular-nums", muted && "text-muted-foreground")}>{formatNumber(value)}</TableCell>;
}

function LoadingRow({ colSpan }: { colSpan: number }) {
    return <TableRow><TableCell colSpan={colSpan} className="h-32 text-center"><LoaderCircle className="mx-auto size-5 animate-spin text-muted-foreground" /></TableCell></TableRow>;
}

function MessageRow({ colSpan, message, destructive = false }: { colSpan: number; message: string; destructive?: boolean }) {
    return <TableRow><TableCell colSpan={colSpan} className={cn("h-32 text-center text-muted-foreground", destructive && "text-destructive")}>{message}</TableCell></TableRow>;
}

function FetchingNotice({ text }: { text: string }) {
    return <div className="fixed bottom-4 end-4 z-40 flex items-center gap-2 border bg-background px-3 py-2 text-xs shadow-lg"><LoaderCircle className="size-4 animate-spin" />{text}</div>;
}

function transactionOptions(t: ReturnType<typeof useI18n>["t"]): TransactionOption[] {
    return [
        { id: "Purchase" as const, name: t("inventory.transaction.purchase") },
        { id: "Sale" as const, name: t("inventory.transaction.sale") },
        { id: "SaleReturn" as const, name: t("inventory.transaction.return") },
        { id: "StockAdjustment" as const, name: t("inventory.transaction.adjustment") },
        { id: "Damaged" as const, name: t("inventory.transaction.damaged") },
        { id: "Expired" as const, name: t("inventory.transaction.expired") },
        { id: "Transfer" as const, name: t("inventory.transaction.transfer") },
        { id: "Reservation" as const, name: t("inventory.transaction.reservation") },
        { id: "ReservationRelease" as const, name: t("inventory.transaction.release") },
    ];
}

function formatNumber(value: number | undefined) {
    if (value === undefined) return "0";
    return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function useDebouncedValue<T>(value: T, delay: number) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const timeout = window.setTimeout(() => setDebounced(value), delay);
        return () => window.clearTimeout(timeout);
    }, [delay, value]);
    return debounced;
}
