import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    AlertTriangle,
    Eye,
    LoaderCircle,
    Mail,
    Phone,
    Plus,
    Radio,
    RefreshCw,
    Rows3,
    Search,
    Trash2,
} from "lucide-react";
import { useDeferredValue, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { ListPagination } from "@/components/list-pagination";
import { PageHeader } from "@/components/page-header";
import { SimpleCombobox } from "@/components/simple-combobox";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useCompany } from "@/features/company/company-context";
import { useCustomerPresenceStream } from "@/features/customers/customer-presence-stream";
import { customerQueryKeys } from "@/features/customers/customer-query-keys";
import { customerService } from "@/features/customers/customer-service";
import type {
    CustomerDetails,
    CustomerListItem,
    UpsertCustomerRequest,
} from "@/features/customers/customer-types";
import { WhatsAppLink } from "@/features/customers/whatsapp-link";
import { useProductLookupsQuery } from "@/features/products/hooks/use-product-mutation";
import { useI18n } from "@/i18n/i18n-provider";

interface CustomerForm {
    id?: number;
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    address: string;
    customerTypeId: string;
    creditLimit: string;
    debtDueDays: string;
}

const emptyForm = (): CustomerForm => ({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    address: "",
    customerTypeId: "",
    creditLimit: "",
    debtDueDays: "",
});

const customerSheetGridClass =
    "grid grid-cols-[48px_150px_150px_160px_190px_150px_140px_130px_320px_48px] gap-2";

export default function CustomersPage() {
    const queryClient = useQueryClient();
    const { locale, t, tf } = useI18n();
    const { data: lookups } = useProductLookupsQuery();
    const [search, setSearch] = useState("");
    const deferredSearch = useDeferredValue(search.trim());
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [open, setOpen] = useState(false);
    const [bulkOpen, setBulkOpen] = useState(false);
    const [bulkLoading, setBulkLoading] = useState(false);
    const [bulkSaving, setBulkSaving] = useState(false);
    const [selected, setSelected] = useState<number[]>([]);
    const [form, setForm] = useState<CustomerForm>(emptyForm);
    const [rows, setRows] = useState<CustomerForm[]>([]);
    const realtimeStatus = useCustomerPresenceStream();

    const query = useQuery({
        queryKey: customerQueryKeys.list({
            search: deferredSearch || undefined,
            page,
            pageSize,
        }),
        queryFn: () =>
            customerService.getCustomers({
                search: deferredSearch || undefined,
                page,
                pageSize,
            }),
        refetchInterval: 20_000,
    });

    const create = useMutation({
        mutationFn: (request: UpsertCustomerRequest) =>
            customerService.createCustomer(request),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: customerQueryKeys.all });
            setOpen(false);
            setForm(emptyForm());
            toast.success(t("customers.created"));
        },
        onError: (error) => toast.error(getErrorMessage(error, t("customers.operationFailed"))),
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        create.mutate(toRequest(form, lookups?.defaultCustomerTypeId ?? null));
    };

    const openBulkSheet = async () => {
        setBulkOpen(true);
        if (!selected.length) {
            setRows([emptyForm(), emptyForm(), emptyForm()]);
            return;
        }

        setBulkLoading(true);
        try {
            const customers = await Promise.all(
                selected.map((id) => customerService.getCustomer(id)),
            );
            setRows(customers.map(toForm));
        } catch (error) {
            toast.error(getErrorMessage(error, t("customers.operationFailed")));
            setBulkOpen(false);
        } finally {
            setBulkLoading(false);
        }
    };

    const saveBulk = async () => {
        const meaningfulRows = rows.filter(
            (row) => row.id || row.firstName.trim() || row.phone.trim(),
        );
        const invalid = meaningfulRows.findIndex(
            (row) => !row.firstName.trim() || !row.phone.trim(),
        );
        if (invalid >= 0) {
            toast.error(tf("customers.rowRequired", { count: invalid + 1 }));
            return;
        }

        const phones = meaningfulRows.map((row) => row.phone.replace(/\s/g, ""));
        if (new Set(phones).size !== phones.length) {
            toast.error(t("customers.uniquePhone"));
            return;
        }
        if (!meaningfulRows.length) {
            toast.error(t("customers.addAtLeastOne"));
            return;
        }

        setBulkSaving(true);
        try {
            await Promise.all(
                meaningfulRows.map((row) =>
                    row.id
                        ? customerService.updateCustomer(
                              row.id,
                              toRequest(row, lookups?.defaultCustomerTypeId ?? null),
                          )
                        : customerService.createCustomer(
                              toRequest(row, lookups?.defaultCustomerTypeId ?? null),
                          ),
                ),
            );
            await queryClient.invalidateQueries({ queryKey: customerQueryKeys.all });
            toast.success(tf("customers.rowsSaved", { count: meaningfulRows.length }));
            setSelected([]);
            setBulkOpen(false);
        } catch (error) {
            toast.error(getErrorMessage(error, t("customers.operationFailed")));
        } finally {
            setBulkSaving(false);
        }
    };

    const data = query.data;
    const allVisibleSelected =
        Boolean(data?.items.length) &&
        data!.items.every((item) => selected.includes(item.id));
    const toggleSelected = (id: number, checked: boolean) =>
        setSelected((current) =>
            checked
                ? [...new Set([...current, id])]
                : current.filter((item) => item !== id),
        );

    return (
        <div className="min-w-0 space-y-5">
            <PageHeader
                title={t("customers.title")}
                description={t("customers.subtitle")}
                actions={
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => void openBulkSheet()}>
                            <Rows3 />
                            {selected.length
                                ? tf("customers.bulkEdit", { count: selected.length })
                                : t("customers.bulkCreate")}
                        </Button>
                        <Button onClick={() => setOpen(true)}>
                            <Plus />
                            {t("customers.add")}
                        </Button>
                    </div>
                }
            />

            <Card>
                <CardContent>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="relative min-w-0 flex-1 sm:max-w-xl">
                            <Search className="absolute start-2 top-2 size-4 text-muted-foreground" />
                            <Input
                                className="ps-8"
                                value={search}
                                onChange={(event) => {
                                    setSearch(event.target.value);
                                    setPage(1);
                                }}
                                placeholder={t("customers.search")}
                            />
                        </div>
                        <div className="flex items-center gap-2 sm:ms-auto">
                            <Badge
                                variant="outline"
                                className={realtimeStatus === "live"
                                    ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                    : "text-muted-foreground"}
                            >
                                <Radio className={realtimeStatus === "live" ? "size-3.5 animate-pulse" : "size-3.5"} />
                                {realtimeStatus === "live"
                                    ? t("customers.liveCrm")
                                    : t("customers.pollingFallback")}
                            </Badge>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={query.isFetching}
                                onClick={() => void query.refetch()}
                            >
                                <RefreshCw className={query.isFetching ? "animate-spin" : undefined} />
                                {t("customers.refresh")}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="min-w-0 overflow-hidden">
                <CardContent className="p-0">
                    <CustomerCardList
                        customers={data?.items ?? []}
                        isLoading={query.isLoading}
                        selected={selected}
                        onSelectedChange={toggleSelected}
                        locale={locale}
                    />

                    <div className="hidden xl:block">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-10">
                                        <Checkbox
                                            checked={allVisibleSelected}
                                            onCheckedChange={(checked) =>
                                                setSelected(
                                                    checked === true
                                                        ? data?.items.map((item) => item.id) ?? []
                                                        : [],
                                                )
                                            }
                                        />
                                    </TableHead>
                                    <TableHead>{t("customers.customer")}</TableHead>
                                    <TableHead>{t("customers.phone")}</TableHead>
                                    <TableHead>{t("customers.type")}</TableHead>
                                    <TableHead>{t("customers.sales")}</TableHead>
                                    <TableHead>{t("customers.outstandingDebt")}</TableHead>
                                    <TableHead>{t("customers.accountCredit")}</TableHead>
                                    <TableHead>{t("customers.lastOrder")}</TableHead>
                                    <TableHead />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {query.isLoading ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={9}
                                            className="h-24 text-center text-muted-foreground"
                                        >
                                            {t("customers.loading")}
                                        </TableCell>
                                    </TableRow>
                                ) : null}
                                {data?.items.map((customer) => (
                                    <CustomerTableRow
                                        key={customer.id}
                                        customer={customer}
                                        selected={selected.includes(customer.id)}
                                        onSelectedChange={(checked) =>
                                            toggleSelected(customer.id, checked)
                                        }
                                        locale={locale}
                                    />
                                ))}
                                {!query.isLoading && data?.items.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={9}
                                            className="h-24 text-center text-muted-foreground"
                                        >
                                            {t("customers.empty")}
                                        </TableCell>
                                    </TableRow>
                                ) : null}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                <ListPagination
                    page={page}
                    pageSize={pageSize}
                    totalCount={data?.totalCount ?? 0}
                    totalPages={data?.totalPages}
                    disabled={query.isFetching}
                    onPageChange={setPage}
                    onPageSizeChange={(size) => {
                        setPageSize(size);
                        setPage(1);
                    }}
                />
            </Card>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <form onSubmit={submit}>
                        <DialogHeader>
                            <DialogTitle>{t("customers.add")}</DialogTitle>
                            <DialogDescription>
                                {t("customers.createDescription")}
                            </DialogDescription>
                        </DialogHeader>
                        <CustomerFields
                            form={form}
                            setForm={setForm}
                            customerTypes={lookups?.customerTypes ?? []}
                            defaultCustomerTypeId={lookups?.defaultCustomerTypeId ?? null}
                        />
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setOpen(false)}
                            >
                                {t("customers.cancel")}
                            </Button>
                            <Button
                                type="submit"
                                disabled={
                                    create.isPending ||
                                    !form.firstName.trim() ||
                                    !form.phone.trim()
                                }
                            >
                                {create.isPending
                                    ? t("customers.saving")
                                    : t("customers.create")}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Sheet open={bulkOpen} onOpenChange={setBulkOpen}>
                <SheetContent className="!w-screen !max-w-none border-0" side="right">
                    <SheetHeader className="border-b">
                        <SheetTitle>{t("customers.sheetTitle")}</SheetTitle>
                        <SheetDescription>
                            {selected.length
                                ? t("customers.sheetEditDescription")
                                : t("customers.sheetCreateDescription")}
                        </SheetDescription>
                    </SheetHeader>
                    <div className="min-h-0 flex-1 overflow-auto p-4">
                        {bulkLoading ? (
                            <div className="grid h-48 place-items-center">
                                <LoaderCircle className="size-6 animate-spin" />
                            </div>
                        ) : (
                            <div className="w-full min-w-[1460px] overflow-hidden rounded-xl border">
                                <div
                                    className={`${customerSheetGridClass} sticky top-0 z-10 border-b bg-muted p-2 text-xs font-bold shadow-sm`}
                                >
                                    <span>#</span>
                                    <span>{t("customers.firstName")}</span>
                                    <span>{t("customers.lastName")}</span>
                                    <span>{t("customers.phone")} *</span>
                                    <span>{t("customers.email")}</span>
                                    <span>{t("customers.customerType")}</span>
                                    <span>{t("customers.creditLimit")}</span>
                                    <span>{t("customers.debtDueDays")}</span>
                                    <span>{t("customers.address")}</span>
                                    <span />
                                </div>
                                {rows.map((row, index) => (
                                    <BulkCustomerRow
                                        key={`${row.id ?? "new"}-${index}`}
                                        row={row}
                                        index={index}
                                        customerTypes={lookups?.customerTypes ?? []}
                                        defaultCustomerTypeId={
                                            lookups?.defaultCustomerTypeId ?? null
                                        }
                                        onChange={(next) =>
                                            setRows((current) =>
                                                current.map((item, itemIndex) =>
                                                    itemIndex === index ? next : item,
                                                ),
                                            )
                                        }
                                        onRemove={() =>
                                            setRows((current) =>
                                                current.filter(
                                                    (_, itemIndex) => itemIndex !== index,
                                                ),
                                            )
                                        }
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                    <SheetFooter className="flex-row justify-between border-t">
                        <Button
                            variant="outline"
                            onClick={() =>
                                setRows((current) => [...current, emptyForm()])
                            }
                        >
                            <Plus />
                            {t("customers.addRow")}
                        </Button>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setBulkOpen(false)}>
                                {t("customers.cancel")}
                            </Button>
                            <Button
                                disabled={bulkSaving || bulkLoading}
                                onClick={() => void saveBulk()}
                            >
                                {bulkSaving ? (
                                    <LoaderCircle className="animate-spin" />
                                ) : (
                                    <Rows3 />
                                )}
                                {t("customers.saveSheet")}
                            </Button>
                        </div>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
        </div>
    );
}

function CustomerCardList({
    customers,
    isLoading,
    selected,
    onSelectedChange,
    locale,
}: {
    customers: CustomerListItem[];
    isLoading: boolean;
    selected: number[];
    onSelectedChange: (id: number, checked: boolean) => void;
    locale: string;
}) {
    const { t } = useI18n();
    const { formatMoney } = useCompany();

    if (isLoading) {
        return (
            <div className="grid min-h-40 place-items-center px-4 text-sm text-muted-foreground xl:hidden">
                <span className="inline-flex items-center gap-2">
                    <LoaderCircle className="size-4 animate-spin" />
                    {t("customers.loading")}
                </span>
            </div>
        );
    }

    if (!customers.length) {
        return (
            <div className="grid min-h-40 place-items-center px-4 text-sm text-muted-foreground xl:hidden">
                {t("customers.empty")}
            </div>
        );
    }

    return (
        <div className="grid gap-3 p-3 sm:grid-cols-2 xl:hidden">
            {customers.map((customer) => (
                <article
                    key={customer.id}
                    className="min-w-0 rounded-xl border bg-background p-4 shadow-xs"
                >
                    <div className="flex items-start gap-3">
                        <Checkbox
                            className="mt-1"
                            checked={selected.includes(customer.id)}
                            onCheckedChange={(checked) =>
                                onSelectedChange(customer.id, checked === true)
                            }
                        />
                        <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                <h3 className="min-w-0 truncate font-semibold">
                                    {customer.name}
                                </h3>
                                {customer.isOnline ? (
                                    <Badge
                                        variant="outline"
                                        className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                                    >
                                        <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                                        {t("customers.online")}
                                    </Badge>
                                ) : null}
                                {customer.hasOverdueDebt ? (
                                    <Badge variant="destructive">
                                        <AlertTriangle className="size-3" />
                                        {t("customers.overdue")}
                                    </Badge>
                                ) : null}
                            </div>
                            <p className="mt-1 truncate text-xs text-muted-foreground">
                                {customer.customerTypeName ?? t("customers.default")}
                            </p>
                        </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <CustomerMetric
                            label={t("customers.sales")}
                            value={formatMoney(customer.totalSpent)}
                        />
                        <CustomerMetric
                            label={t("customers.outstandingDebt")}
                            value={formatMoney(customer.outstandingDebt)}
                            danger={customer.outstandingDebt > 0}
                        />
                        <CustomerMetric
                            label={t("customers.accountCredit")}
                            value={formatMoney(customer.accountCredit)}
                            positive={customer.accountCredit > 0}
                        />
                        <CustomerMetric
                            label={t("customers.lastOrder")}
                            value={
                                customer.lastOrderAt
                                    ? new Date(customer.lastOrderAt).toLocaleDateString(locale)
                                    : "—"
                            }
                        />
                    </div>

                    <div className="mt-3 space-y-1.5 border-t pt-3 text-xs text-muted-foreground">
                        <a
                            className="flex min-w-0 items-center gap-2 hover:text-primary"
                            href={`tel:${customer.phone}`}
                        >
                            <Phone className="size-3.5 shrink-0" />
                            <span className="truncate">{customer.phone}</span>
                        </a>
                        <span className="flex min-w-0 items-center gap-2">
                            <Mail className="size-3.5 shrink-0" />
                            <span className="truncate">
                                {customer.email ?? t("customers.noEmail")}
                            </span>
                        </span>
                    </div>

                    <div className="mt-3 flex items-center justify-end gap-2">
                        <WhatsAppLink
                            url={customer.whatsAppUrl}
                            customerName={customer.name}
                            compact
                        />
                        <Link
                            className={buttonVariants({ size: "sm", variant: "outline" })}
                            to={`/customers/${customer.id}`}
                        >
                            <Eye className="size-3.5" />
                            {t("customers.view")}
                        </Link>
                    </div>
                </article>
            ))}
        </div>
    );
}

function CustomerTableRow({
    customer,
    selected,
    onSelectedChange,
    locale,
}: {
    customer: CustomerListItem;
    selected: boolean;
    onSelectedChange: (checked: boolean) => void;
    locale: string;
}) {
    const { formatMoney } = useCompany();
    const { t, tf } = useI18n();

    return (
        <TableRow
            className={customer.hasOverdueDebt ? "bg-destructive/[0.035]" : undefined}
        >
            <TableCell>
                <Checkbox
                    checked={selected}
                    onCheckedChange={(checked) => onSelectedChange(checked === true)}
                />
            </TableCell>
            <TableCell>
                <div className="flex items-center gap-2">
                    <span className="font-semibold">{customer.name}</span>
                    {customer.isOnline ? (
                        <Badge
                            variant="outline"
                            className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                        >
                            <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
                            {t("customers.online")}
                            {customer.activeSessions > 1
                                ? ` · ${customer.activeSessions}`
                                : ""}
                        </Badge>
                    ) : null}
                    {customer.hasOverdueDebt ? (
                        <Badge variant="destructive">
                            <AlertTriangle className="size-3" />
                            {t("customers.overdue")}
                        </Badge>
                    ) : null}
                </div>
                <div className="text-muted-foreground">
                    {customer.email ?? t("customers.noEmail")}
                </div>
            </TableCell>
            <TableCell>
                <a className="hover:text-primary hover:underline" href={`tel:${customer.phone}`}>
                    {customer.phone}
                </a>
            </TableCell>
            <TableCell>{customer.customerTypeName ?? t("customers.default")}</TableCell>
            <TableCell>{formatMoney(customer.totalSpent)}</TableCell>
            <TableCell>
                <span
                    className={
                        customer.outstandingDebt > 0
                            ? "font-semibold text-destructive"
                            : "text-muted-foreground"
                    }
                >
                    {formatMoney(customer.outstandingDebt)}
                </span>
                <div className="text-xs text-muted-foreground">
                    {tf("customers.limit", { amount: formatMoney(customer.creditLimit) })}
                </div>
            </TableCell>
            <TableCell>
                <span
                    className={
                        customer.accountCredit > 0
                            ? "font-semibold text-emerald-600"
                            : "text-muted-foreground"
                    }
                >
                    {formatMoney(customer.accountCredit)}
                </span>
            </TableCell>
            <TableCell>
                {customer.lastOrderAt
                    ? new Date(customer.lastOrderAt).toLocaleString(locale)
                    : "—"}
            </TableCell>
            <TableCell>
                <div className="flex justify-end gap-2">
                    <WhatsAppLink
                        url={customer.whatsAppUrl}
                        customerName={customer.name}
                        compact
                    />
                    <Link
                        className={buttonVariants({ size: "sm", variant: "outline" })}
                        to={`/customers/${customer.id}`}
                    >
                        <Eye className="size-3.5" />
                        {t("customers.view")}
                    </Link>
                </div>
            </TableCell>
        </TableRow>
    );
}

function CustomerMetric({
    label,
    value,
    danger = false,
    positive = false,
}: {
    label: string;
    value: string;
    danger?: boolean;
    positive?: boolean;
}) {
    return (
        <div className="min-w-0 rounded-lg bg-muted/45 p-2.5">
            <p className="truncate text-[10px] text-muted-foreground">{label}</p>
            <p
                className={`mt-1 truncate font-semibold tabular-nums ${
                    danger
                        ? "text-destructive"
                        : positive
                          ? "text-emerald-600"
                          : "text-foreground"
                }`}
            >
                {value}
            </p>
        </div>
    );
}

function CustomerFields({
    form,
    setForm,
    customerTypes,
    defaultCustomerTypeId,
}: {
    form: CustomerForm;
    setForm: React.Dispatch<React.SetStateAction<CustomerForm>>;
    customerTypes: { id: number; name: string }[];
    defaultCustomerTypeId: number | null;
}) {
    const { t } = useI18n();
    return (
        <div className="my-5 grid gap-4 sm:grid-cols-2">
            <Field label={t("customers.firstName")}>
                <Input
                    value={form.firstName}
                    onChange={(event) =>
                        setForm((current) => ({ ...current, firstName: event.target.value }))
                    }
                />
            </Field>
            <Field label={t("customers.lastName")}>
                <Input
                    value={form.lastName}
                    onChange={(event) =>
                        setForm((current) => ({ ...current, lastName: event.target.value }))
                    }
                />
            </Field>
            <Field label={`${t("customers.phone")} *`}>
                <Input
                    value={form.phone}
                    onChange={(event) =>
                        setForm((current) => ({ ...current, phone: event.target.value }))
                    }
                />
            </Field>
            <Field label={t("customers.email")}>
                <Input
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                        setForm((current) => ({ ...current, email: event.target.value }))
                    }
                />
            </Field>
            <Field label={t("customers.customerType")}>
                <CustomerTypeSelect
                    value={form.customerTypeId}
                    options={customerTypes}
                    defaultId={defaultCustomerTypeId}
                    onChange={(customerTypeId) =>
                        setForm((current) => ({ ...current, customerTypeId }))
                    }
                />
            </Field>
            <Field label={t("customers.creditLimitOverride")}>
                <Input
                    type="number"
                    min={0}
                    value={form.creditLimit}
                    placeholder={t("customers.companyLimit")}
                    onChange={(event) =>
                        setForm((current) => ({ ...current, creditLimit: event.target.value }))
                    }
                />
            </Field>
            <Field label={t("customers.debtDueDaysOverride")}>
                <Input
                    type="number"
                    min={0}
                    max={3650}
                    value={form.debtDueDays}
                    placeholder={t("customers.companyDefault")}
                    onChange={(event) =>
                        setForm((current) => ({ ...current, debtDueDays: event.target.value }))
                    }
                />
            </Field>
            <div className="space-y-2 sm:col-span-2">
                <Label>{t("customers.address")}</Label>
                <Textarea
                    value={form.address}
                    onChange={(event) =>
                        setForm((current) => ({ ...current, address: event.target.value }))
                    }
                />
            </div>
        </div>
    );
}

function BulkCustomerRow({
    row,
    index,
    customerTypes,
    defaultCustomerTypeId,
    onChange,
    onRemove,
}: {
    row: CustomerForm;
    index: number;
    customerTypes: { id: number; name: string }[];
    defaultCustomerTypeId: number | null;
    onChange: (row: CustomerForm) => void;
    onRemove: () => void;
}) {
    const { t, tf } = useI18n();
    const field = (key: keyof CustomerForm, value: string) =>
        onChange({ ...row, [key]: value });

    return (
        <div className={`${customerSheetGridClass} border-b p-2 last:border-b-0`}>
            <span className="self-center text-center font-semibold text-muted-foreground">
                {index + 1}
            </span>
            <Input
                value={row.firstName}
                onChange={(event) => field("firstName", event.target.value)}
            />
            <Input
                value={row.lastName}
                onChange={(event) => field("lastName", event.target.value)}
            />
            <Input value={row.phone} onChange={(event) => field("phone", event.target.value)} />
            <Input
                type="email"
                value={row.email}
                onChange={(event) => field("email", event.target.value)}
            />
            <CustomerTypeSelect
                value={row.customerTypeId}
                options={customerTypes}
                defaultId={defaultCustomerTypeId}
                onChange={(value) => field("customerTypeId", value)}
            />
            <Input
                type="number"
                min={0}
                value={row.creditLimit}
                onChange={(event) => field("creditLimit", event.target.value)}
            />
            <Input
                type="number"
                min={0}
                max={3650}
                value={row.debtDueDays}
                onChange={(event) => field("debtDueDays", event.target.value)}
            />
            <Input
                aria-label={tf("customers.rowAddress", { count: index + 1 })}
                placeholder={t("customers.addressPlaceholder")}
                title={row.address || t("customers.customerAddress")}
                value={row.address}
                onChange={(event) => field("address", event.target.value)}
            />
            <Button
                type="button"
                aria-label={tf("customers.removeRow", { count: index + 1 })}
                size="icon"
                variant="ghost"
                onClick={onRemove}
            >
                <Trash2 className="size-4 text-destructive" />
            </Button>
        </div>
    );
}

function CustomerTypeSelect({
    value,
    options,
    defaultId,
    onChange,
}: {
    value: string;
    options: { id: number; name: string }[];
    defaultId: number | null;
    onChange: (value: string) => void;
}) {
    const { t } = useI18n();
    const selectedValue = value || (defaultId ? String(defaultId) : null);

    return (
        <SimpleCombobox<string>
            value={selectedValue}
            onValueChange={(next) => onChange(next ?? "")}
            options={options.map((option) => ({
                value: String(option.id),
                label: option.name,
                description:
                    option.id === defaultId ? t("customers.defaultType") : undefined,
            }))}
            placeholder={t("customers.selectType")}
            emptyText={t("customers.noTypes")}
        />
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            {children}
        </div>
    );
}

function clean(value: string) {
    const result = value.trim();
    return result || null;
}

function toRequest(
    form: CustomerForm,
    defaultCustomerTypeId: number | null,
): UpsertCustomerRequest {
    return {
        firstName: form.firstName.trim(),
        lastName: clean(form.lastName),
        phone: form.phone.trim(),
        email: clean(form.email),
        address: clean(form.address),
        customerTypeId: form.customerTypeId
            ? Number(form.customerTypeId)
            : defaultCustomerTypeId,
        creditLimit: form.creditLimit === "" ? null : Number(form.creditLimit),
        debtDueDays: form.debtDueDays === "" ? null : Number(form.debtDueDays),
    };
}

function toForm(customer: CustomerDetails): CustomerForm {
    return {
        id: customer.id,
        firstName: customer.firstName,
        lastName: customer.lastName ?? "",
        phone: customer.phone,
        email: customer.email ?? "",
        address: customer.address ?? "",
        customerTypeId: customer.customerTypeId ? String(customer.customerTypeId) : "",
        creditLimit: customer.creditLimit ? String(customer.creditLimit) : "",
        debtDueDays: String(customer.debtDueDays),
    };
}

function getErrorMessage(error: unknown, fallback: string) {
    return (
        (error as { response?: { data?: { message?: string } }; message?: string })
            ?.response?.data?.message ??
        (error as Error)?.message ??
        fallback
    );
}
