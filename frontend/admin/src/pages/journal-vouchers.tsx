import {
    useDeferredValue,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    ArrowRight,
    BadgeCheck,
    BookOpenCheck,
    Bot,
    Building2,
    CalendarDays,
    CheckCircle2,
    Download,
    Eye,
    FileClock,
    FileText,
    Landmark,
    LoaderCircle,
    Plus,
    ReceiptText,
    RefreshCw,
    RotateCcw,
    Save,
    Scale,
    Search,
    ShieldCheck,
    Trash2,
    UsersRound,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { ListPagination } from "@/components/list-pagination";
import { PageHeader } from "@/components/page-header";
import { ServerSearchCombobox } from "@/components/server-search-combobox";
import { SimpleCombobox } from "@/components/simple-combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAdminAuth } from "@/features/auth/auth-context";
import { hasPermission, Permissions } from "@/features/auth/permissions";
import { CustomerLedgerCard } from "@/features/company/customer-ledger-card";
import { useCompany } from "@/features/company/company-context";
import { operationsService } from "@/features/operations/operations-service";
import type {
    CreateJournalVoucher,
    JournalAccountBalance,
    JournalAccountLedger,
    JournalVoucher,
    JournalVoucherStatus,
    JournalVoucherType,
    OperationCustomer,
    Supplier,
    SupplierLedger,
} from "@/features/operations/operations-types";
import { getApiErrorMessage } from "@/lib/api-error";
import { createUuid } from "@/lib/create-uuid";
import { cn } from "@/lib/utils";

type DraftLine = CreateJournalVoucher["lines"][number] & { key: string };
type ManualVoucherType = CreateJournalVoucher["voucherType"];
type WorkspaceView = "vouchers" | "ledger" | "parties";

const newLine = (): DraftLine => ({
    key: createUuid(),
    accountCode: "",
    accountName: "",
    description: null,
    debit: 0,
    credit: 0,
});

const standardAccounts = [
    { code: "1000", name: "Cash on Hand" },
    { code: "1010", name: "Bank Account" },
    { code: "1020", name: "Mobile Money / Electronic Wallet" },
    { code: "1100", name: "Accounts Receivable" },
    { code: "1200", name: "Inventory" },
    { code: "1300", name: "Prepaid Expenses" },
    { code: "1500", name: "Fixed Assets" },
    { code: "2000", name: "Accounts Payable" },
    { code: "2050", name: "Customer Credit and Deposits" },
    { code: "2100", name: "Accrued Expenses" },
    { code: "2200", name: "Payroll Payable" },
    { code: "2300", name: "Sales Tax Payable" },
    { code: "3000", name: "Owner Capital" },
    { code: "3100", name: "Owner Drawings" },
    { code: "4000", name: "Sales Revenue" },
    { code: "4100", name: "Other Income" },
    { code: "4200", name: "Shipping Revenue" },
    { code: "5000", name: "Cost of Goods Sold" },
    { code: "6000", name: "Operating Expense" },
    { code: "6100", name: "Salary Expense" },
    { code: "6200", name: "Rent Expense" },
    { code: "6300", name: "Utilities Expense" },
] as const;

const voucherTypes: { value: JournalVoucherType; label: string }[] = [
    { value: "Purchase", label: "Purchase accrual" },
    { value: "PurchasePayment", label: "Supplier payment" },
    { value: "ManualSale", label: "Manual sale" },
    { value: "SaleReceipt", label: "Customer receipt" },
    { value: "OnlineSale", label: "Online sale" },
    { value: "OnlineReceipt", label: "Online receipt" },
    { value: "Expense", label: "Expense payment" },
    { value: "PayrollAccrual", label: "Payroll accrual" },
    { value: "PayrollPayment", label: "Payroll payment" },
    { value: "ManualAdjustment", label: "Manual adjustment" },
    { value: "OpeningBalance", label: "Opening balance" },
    { value: "FundsTransfer", label: "Funds transfer" },
    { value: "OwnerEquity", label: "Owner equity" },
    { value: "Reversal", label: "Reversal" },
];

const manualTypes: { value: ManualVoucherType; label: string; description: string }[] = [
    { value: "ManualAdjustment", label: "Accounting adjustment", description: "Documented correction or accrual not created by another module." },
    { value: "OpeningBalance", label: "Opening balance", description: "Bring audited balances into this accounting ledger." },
    { value: "FundsTransfer", label: "Cash / bank transfer", description: "Move money between cash, bank, and electronic-payment accounts." },
    { value: "OwnerEquity", label: "Owner capital / drawings", description: "Record capital introduced or owner withdrawals." },
];

const voucherTemplates = [
    { title: "Owner capital received", type: "OwnerEquity" as const, memo: "Owner capital introduced into cash", debit: "1000", credit: "3000" },
    { title: "Cash deposited to bank", type: "FundsTransfer" as const, memo: "Transfer from cash on hand to bank", debit: "1010", credit: "1000" },
    { title: "Opening inventory", type: "OpeningBalance" as const, memo: "Audited opening inventory balance", debit: "1200", credit: "3000" },
    { title: "Expense accrued", type: "ManualAdjustment" as const, memo: "Operating expense accrued for later payment", debit: "6000", credit: "2100" },
] as const;

const commonCurrencies = ["AFN", "USD", "PKR"];

export default function JournalVouchersPage() {
    const queryClient = useQueryClient();
    const { formatMoney, company } = useCompany();
    const { user } = useAdminAuth();
    const canManage = hasPermission(user, Permissions.ExpensesManage);
    const [view, setView] = useState<WorkspaceView>("vouchers");
    const [adjustmentOpen, setAdjustmentOpen] = useState(false);
    const [reverseVoucher, setReverseVoucher] = useState<JournalVoucher | null>(null);
    const [reversalReason, setReversalReason] = useState("");
    const [selectedVoucher, setSelectedVoucher] = useState<JournalVoucher | null>(null);

    const summary = useQuery({
        queryKey: ["journal-vouchers", "summary"],
        queryFn: async () => (await operationsService.journalVoucherSummary()).data,
    });
    const accountBalances = useQuery({
        queryKey: ["journal-vouchers", "accounts"],
        queryFn: async () => (await operationsService.journalAccountBalances()).data,
    });
    const refreshAccounting = async () => {
        await queryClient.invalidateQueries({ queryKey: ["journal-vouchers"] });
    };
    const sync = useMutation({
        mutationFn: operationsService.syncJournalVouchers,
        onSuccess: async (response) => {
            await refreshAccounting();
            toast.success(response.data.createdVouchers
                ? `${response.data.createdVouchers} missing operational vouchers were created.`
                : "Accounting is already synchronized with every operational transaction.");
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "The operational vouchers could not be synchronized.")),
    });
    const reverse = useMutation({
        mutationFn: ({ id, reason }: { id: number; reason: string }) => operationsService.reverseJournalVoucher(id, reason),
        onSuccess: async (response) => {
            await refreshAccounting();
            toast.success(`Reversal ${response.data.voucherNumber} was posted.`);
            setReverseVoucher(null);
            setReversalReason("");
        },
        onError: (error) => toast.error(getApiErrorMessage(error, "The voucher could not be reversed.")),
    });

    const currencies = useMemo(
        () => currencyOptions(company?.settings.mainCurrencyCode, accountBalances.data?.map((item) => item.currencyCode)),
        [accountBalances.data, company?.settings.mainCurrencyCode],
    );

    return (
        <div className="space-y-5">
            <PageHeader
                title="Finance & accounting"
                description="Post, review, and print balanced vouchers; inspect every account movement; and manage customer and supplier statements from one finance workspace."
                actions={canManage ? (
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" disabled={sync.isPending} onClick={() => sync.mutate()}>
                            {sync.isPending ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
                            {sync.isPending ? "Synchronizing…" : "Sync transactions"}
                        </Button>
                        <Button onClick={() => setAdjustmentOpen(true)}><Plus />New voucher</Button>
                    </div>
                ) : undefined}
            />

            <section className="company-gradient overflow-hidden border">
                <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                    <div className="flex items-start gap-3">
                        <span className="grid size-11 shrink-0 place-items-center bg-primary text-primary-foreground"><ShieldCheck className="size-5" /></span>
                        <div>
                            <p className="font-heading text-base font-bold">Source-controlled double-entry accounting</p>
                            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                                Sales, purchases, receipts, supplier payments, expenses, payroll, and delivered online orders create balanced postings automatically. Manual vouchers are immutable and corrections use traceable reversals.
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                        <StatusPill icon={<BadgeCheck />} text="Balanced postings" />
                        <StatusPill icon={<FileClock />} text="Full audit trail" />
                        <StatusPill icon={<Landmark />} text="Multi-currency ledgers" />
                    </div>
                </div>
            </section>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Metric icon={<ReceiptText />} label="Total vouchers" value={summary.data?.totalVouchers ?? 0} help="All posted and reversed records" />
                <Metric icon={<Bot />} label="Workflow generated" value={summary.data?.systemGeneratedVouchers ?? 0} help="Created from business activity" tone="positive" />
                <Metric icon={<Scale />} label="Posted value" value={formatMoney(summary.data?.totalPostedDebits ?? 0, summary.data?.currencyCode)} help={`${summary.data?.currencyCode ?? "Base currency"} debit total`} />
                <Metric icon={<CalendarDays />} label="Last posting" value={summary.data?.lastPostingDate ? shortDate(summary.data.lastPostingDate) : "No postings"} help={`${summary.data?.manualVouchers ?? 0} controlled adjustments`} />
            </div>

            <Card className="overflow-hidden shadow-none">
                <div className="flex flex-col border-b bg-muted/20 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex overflow-x-auto p-2">
                        <WorkspaceTab active={view === "vouchers"} icon={<ReceiptText />} label="Voucher register" onClick={() => setView("vouchers")} />
                        <WorkspaceTab active={view === "ledger"} icon={<BookOpenCheck />} label="General ledger" onClick={() => setView("ledger")} />
                        <WorkspaceTab active={view === "parties"} icon={<UsersRound />} label="Party ledgers" onClick={() => setView("parties")} />
                    </div>
                    <p className="px-4 pb-3 text-xs text-muted-foreground lg:pb-0">Accounting records are separated by currency—no hidden conversion.</p>
                </div>

                {view === "vouchers" ? (
                    <VoucherRegister
                        currencies={currencies}
                        canManage={canManage}
                        onOpenVoucher={setSelectedVoucher}
                        onReverse={setReverseVoucher}
                    />
                ) : null}
                {view === "ledger" ? (
                    <GeneralLedgerWorkspace accounts={accountBalances.data ?? []} currencies={currencies} />
                ) : null}
                {view === "parties" ? <PartyLedgersWorkspace /> : null}
            </Card>

            <AdjustmentDialog
                open={adjustmentOpen}
                accounts={accountBalances.data ?? []}
                currencies={currencies}
                onOpenChange={setAdjustmentOpen}
                onSaved={refreshAccounting}
            />
            <VoucherDetailDialog
                voucher={selectedVoucher}
                canManage={canManage}
                onOpenChange={(open) => !open && setSelectedVoucher(null)}
                onReverse={(voucher) => {
                    setSelectedVoucher(null);
                    setReverseVoucher(voucher);
                }}
            />
            <Dialog
                open={Boolean(reverseVoucher)}
                onOpenChange={(open) => {
                    if (!open && !reverse.isPending) {
                        setReverseVoucher(null);
                        setReversalReason("");
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reverse {reverseVoucher?.voucherNumber}</DialogTitle>
                        <DialogDescription>
                            A posted voucher is never deleted. A new voucher will swap its debit and credit lines, preserving the complete audit history.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label>Reversal reason *</Label>
                        <Textarea value={reversalReason} onChange={(event) => setReversalReason(event.target.value)} placeholder="Explain why this accounting entry must be reversed" />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" disabled={reverse.isPending} onClick={() => setReverseVoucher(null)}>Cancel</Button>
                        <Button
                            variant="destructive"
                            disabled={reverse.isPending || !reversalReason.trim()}
                            onClick={() => reverseVoucher && reverse.mutate({ id: reverseVoucher.id, reason: reversalReason.trim() })}
                        >
                            {reverse.isPending ? <LoaderCircle className="animate-spin" /> : <RotateCcw />}
                            Post reversal
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function VoucherRegister({
    currencies,
    canManage,
    onOpenVoucher,
    onReverse,
}: {
    currencies: string[];
    canManage: boolean;
    onOpenVoucher: (voucher: JournalVoucher) => void;
    onReverse: (voucher: JournalVoucher) => void;
}) {
    const { formatMoney } = useCompany();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [search, setSearch] = useState("");
    const deferredSearch = useDeferredValue(search.trim());
    const [type, setType] = useState<JournalVoucherType | "all">("all");
    const [status, setStatus] = useState<JournalVoucherStatus | "all">("all");
    const [origin, setOrigin] = useState<"all" | "system" | "manual">("all");
    const [currency, setCurrency] = useState("all");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    const params = {
        search: deferredSearch || undefined,
        type: type === "all" ? undefined : type,
        status: status === "all" ? undefined : status,
        systemGenerated: origin === "all" ? undefined : origin === "system",
        currencyCode: currency === "all" ? undefined : currency,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page,
        pageSize,
    };
    const query = useQuery({
        queryKey: ["journal-vouchers", "register", params],
        queryFn: async () => (await operationsService.journalVouchers(params)).data,
    });
    const resetPage = () => setPage(1);
    const setPeriod = (days: number | null) => {
        if (days === null) {
            setStartDate("");
            setEndDate("");
        } else {
            const end = new Date();
            const start = new Date(end);
            start.setDate(start.getDate() - days + 1);
            setStartDate(localDate(start));
            setEndDate(localDate(end));
        }
        resetPage();
    };

    return (
        <div>
            <div className="space-y-4 p-4 sm:p-5">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                    <div>
                        <h2 className="font-heading text-lg font-bold">Voucher register</h2>
                        <p className="mt-1 text-sm text-muted-foreground">Find any voucher by number, source, reference, party, or narration.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => setPeriod(1)}>Today</Button>
                        <Button size="sm" variant="outline" onClick={() => setPeriod(30)}>Last 30 days</Button>
                        <Button size="sm" variant="outline" onClick={() => setPeriod(null)}>All time</Button>
                    </div>
                </div>
                <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-[minmax(250px,1fr)_180px_190px_170px]">
                    <div className="relative">
                        <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input className="ps-9" value={search} onChange={(event) => { setSearch(event.target.value); resetPage(); }} placeholder="Voucher, party, source, reference…" />
                    </div>
                    <SimpleCombobox<string> value={type} onValueChange={(value) => { setType((value ?? "all") as JournalVoucherType | "all"); resetPage(); }} options={[{ value: "all", label: "All voucher types" }, ...voucherTypes]} placeholder="All voucher types" />
                    <SimpleCombobox<string> value={origin} onValueChange={(value) => { setOrigin((value ?? "all") as typeof origin); resetPage(); }} options={[{ value: "all", label: "All origins" }, { value: "system", label: "Workflow generated" }, { value: "manual", label: "Manual / controlled" }]} placeholder="All origins" />
                    <SimpleCombobox<string> value={status} onValueChange={(value) => { setStatus((value ?? "all") as JournalVoucherStatus | "all"); resetPage(); }} options={[{ value: "all", label: "All statuses" }, { value: "Posted", label: "Posted" }, { value: "Reversed", label: "Reversed" }]} placeholder="All statuses" />
                </div>
                <div className="grid gap-3 sm:grid-cols-3 xl:max-w-3xl">
                    <Field label="From date"><Input type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); resetPage(); }} /></Field>
                    <Field label="To date"><Input type="date" value={endDate} onChange={(event) => { setEndDate(event.target.value); resetPage(); }} /></Field>
                    <Field label="Currency"><SimpleCombobox<string> value={currency} onValueChange={(value) => { setCurrency(value ?? "all"); resetPage(); }} options={[{ value: "all", label: "All currencies" }, ...currencies.map((code) => ({ value: code, label: code }))]} /></Field>
                </div>
            </div>

            <div className="overflow-x-auto border-t">
                <Table className="min-w-[1120px]">
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date / voucher</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Source</TableHead>
                            <TableHead>Party / narration</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-end">Posted amount</TableHead>
                            <TableHead className="w-28 text-end">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {query.isLoading ? (
                            <TableRow><TableCell colSpan={7} className="h-36 text-center"><LoaderCircle className="mx-auto size-5 animate-spin" /></TableCell></TableRow>
                        ) : query.data?.items.length ? query.data.items.map((voucher) => (
                            <VoucherRow
                                key={voucher.id}
                                voucher={voucher}
                                money={(value) => formatMoney(value, voucher.currencyCode)}
                                canManage={canManage}
                                onOpen={() => onOpenVoucher(voucher)}
                                onReverse={() => onReverse(voucher)}
                            />
                        )) : (
                            <TableRow><TableCell colSpan={7} className="h-36 text-center text-muted-foreground">No vouchers match these filters. Sync historical transactions once if this ledger has not been initialized.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <ListPagination
                page={page}
                pageSize={pageSize}
                totalCount={query.data?.totalCount ?? 0}
                totalPages={query.data?.totalPages}
                disabled={query.isLoading}
                onPageChange={setPage}
                onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
            />
        </div>
    );
}

function VoucherRow({
    voucher,
    money,
    canManage,
    onOpen,
    onReverse,
}: {
    voucher: JournalVoucher;
    money: (value: number) => string;
    canManage: boolean;
    onOpen: () => void;
    onReverse: () => void;
}) {
    const href = sourceHref(voucher);
    const canReverse = canManage && !voucher.isSystemGenerated && voucher.status === "Posted" && voucher.voucherType !== "Reversal";
    return (
        <TableRow className={cn("group", voucher.status === "Reversed" && "bg-muted/20 text-muted-foreground")}>
            <TableCell>
                <p className="font-medium">{shortDate(voucher.voucherDate)}</p>
                <button type="button" className="font-mono text-xs font-bold text-primary hover:underline" onClick={onOpen}>{voucher.voucherNumber}</button>
                <p className="text-[11px] text-muted-foreground">{voucher.currencyCode}{voucher.referenceNumber ? ` · Ref ${voucher.referenceNumber}` : ""}</p>
            </TableCell>
            <TableCell><VoucherTypeBadge voucher={voucher} /></TableCell>
            <TableCell>
                {voucher.sourceNumber ? (href ? <Link className="font-semibold text-primary hover:underline" to={href}>{voucher.sourceNumber}</Link> : <span className="font-semibold">{voucher.sourceNumber}</span>) : <span className="text-muted-foreground">Controlled entry</span>}
                <p className="text-[11px] text-muted-foreground">{voucher.sourceType ?? voucherLabel(voucher.voucherType)}</p>
            </TableCell>
            <TableCell className="max-w-80">
                <p className="font-medium">{voucher.counterpartyName ?? "Company accounts"}</p>
                <p className="truncate text-xs text-muted-foreground" title={voucher.memo}>{voucher.memo}</p>
            </TableCell>
            <TableCell>
                <Badge variant={voucher.status === "Posted" ? "default" : "secondary"}>
                    {voucher.status === "Posted" ? <CheckCircle2 className="size-3" /> : <RotateCcw className="size-3" />}
                    {voucher.status}
                </Badge>
                <p className="mt-1 text-[11px] text-muted-foreground">{voucher.operatorName ?? "System"}</p>
            </TableCell>
            <TableCell className="text-end">
                <p className="font-bold tabular-nums">{money(voucher.totalDebit)}</p>
                <p className="text-[11px] text-muted-foreground">{voucher.lines.length} balanced lines</p>
            </TableCell>
            <TableCell>
                <div className="flex justify-end gap-1">
                    <Button size="icon-sm" variant="ghost" title="View voucher" onClick={onOpen}><Eye /></Button>
                    {canReverse ? <Button size="icon-sm" variant="ghost" title="Reverse voucher" onClick={onReverse}><RotateCcw className="text-destructive" /></Button> : voucher.isSystemGenerated ? <span className="grid size-8 place-items-center" title="Correct this entry from its source workflow"><ShieldCheck className="size-4 text-emerald-600" /></span> : null}
                </div>
            </TableCell>
        </TableRow>
    );
}

function GeneralLedgerWorkspace({ accounts, currencies }: { accounts: JournalAccountBalance[]; currencies: string[] }) {
    const { formatMoney, company } = useCompany();
    const [currency, setCurrency] = useState(company?.settings.mainCurrencyCode ?? currencies[0] ?? "AFN");
    const [selectedCode, setSelectedCode] = useState("");
    const [search, setSearch] = useState("");
    const [dates, setDates] = useState(() => yearToDate());
    const [exporting, setExporting] = useState(false);
    const currencyAccounts = useMemo(
        () => accounts.filter((account) => account.currencyCode === currency && `${account.accountCode} ${account.accountName}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())),
        [accounts, currency, search],
    );

    useEffect(() => {
        const available = accounts.filter((account) => account.currencyCode === currency);
        if (!available.some((account) => account.accountCode === selectedCode)) setSelectedCode(available[0]?.accountCode ?? "");
    }, [accounts, currency, selectedCode]);

    const params = { accountCode: selectedCode, currencyCode: currency, startDate: dates.startDate || undefined, endDate: dates.endDate || undefined };
    const ledger = useQuery({
        queryKey: ["journal-vouchers", "ledger", params],
        queryFn: async () => (await operationsService.journalAccountLedger(params)).data,
        enabled: Boolean(selectedCode),
    });
    const exportPdf = async () => {
        if (!selectedCode) return;
        setExporting(true);
        try {
            await operationsService.downloadJournalAccountLedger(params);
            toast.success("General ledger PDF generated.");
        } catch (error) {
            toast.error(getApiErrorMessage(error, "The general ledger PDF could not be generated."));
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="grid min-h-[620px] lg:grid-cols-[310px_minmax(0,1fr)]">
            <aside className="border-b bg-muted/10 lg:border-b-0 lg:border-e">
                <div className="space-y-3 border-b p-4">
                    <div>
                        <h2 className="font-heading text-base font-bold">Chart of accounts</h2>
                        <p className="mt-1 text-xs text-muted-foreground">Select an account to inspect its running balance.</p>
                    </div>
                    <SimpleCombobox<string> value={currency} onValueChange={(value) => setCurrency(value ?? currencies[0] ?? "AFN")} options={currencies.map((code) => ({ value: code, label: code }))} />
                    <div className="relative"><Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="ps-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find an account…" /></div>
                </div>
                <div className="max-h-[490px] overflow-y-auto">
                    {currencyAccounts.map((account) => (
                        <button
                            key={`${account.accountCode}-${account.currencyCode}`}
                            type="button"
                            className={cn("flex w-full items-center gap-3 border-b px-4 py-3 text-start transition-colors hover:bg-accent", selectedCode === account.accountCode && "border-s-2 border-s-primary bg-primary/5")}
                            onClick={() => setSelectedCode(account.accountCode)}
                        >
                            <span className="grid size-9 shrink-0 place-items-center bg-muted font-mono text-xs font-bold">{account.accountCode}</span>
                            <span className="min-w-0 flex-1"><span className="block truncate font-medium">{account.accountName}</span><span className="block text-[11px] text-muted-foreground">{account.entryCount} entries</span></span>
                            <span className="text-end text-xs font-semibold tabular-nums">{compactBalance(account.balance, (value) => formatMoney(value, account.currencyCode))}</span>
                        </button>
                    ))}
                    {!currencyAccounts.length ? <p className="p-6 text-center text-sm text-muted-foreground">No accounts found for {currency}.</p> : null}
                </div>
            </aside>
            <section className="min-w-0">
                <div className="space-y-4 border-b p-4 sm:p-5">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                        <div>
                            <h2 className="font-heading text-lg font-bold">{ledger.data ? `${ledger.data.accountCode} · ${ledger.data.accountName}` : "General ledger statement"}</h2>
                            <p className="mt-1 text-sm text-muted-foreground">Opening balance, period movements, and a chronological balance after every posting.</p>
                        </div>
                        <Button variant="outline" disabled={!ledger.data || exporting} onClick={() => void exportPdf()}>
                            {exporting ? <LoaderCircle className="animate-spin" /> : <Download />}
                            Download PDF
                        </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end xl:max-w-2xl">
                        <Field label="From"><Input type="date" value={dates.startDate} onChange={(event) => setDates((current) => ({ ...current, startDate: event.target.value }))} /></Field>
                        <Field label="To"><Input type="date" value={dates.endDate} onChange={(event) => setDates((current) => ({ ...current, endDate: event.target.value }))} /></Field>
                        <Button variant="outline" onClick={() => setDates(yearToDate())}>Year to date</Button>
                    </div>
                </div>
                {ledger.isLoading ? <div className="grid h-72 place-items-center"><LoaderCircle className="size-6 animate-spin" /></div> : ledger.isError ? <div className="m-5 border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{getApiErrorMessage(ledger.error, "The account ledger could not be loaded.")}</div> : ledger.data ? <AccountStatement ledger={ledger.data} /> : <div className="grid h-72 place-items-center p-8 text-center text-muted-foreground"><div><BookOpenCheck className="mx-auto mb-3 size-9" /><p className="font-medium">Select an account to open its ledger.</p></div></div>}
            </section>
        </div>
    );
}

function AccountStatement({ ledger }: { ledger: JournalAccountLedger }) {
    const { formatMoney } = useCompany();
    const money = (value: number) => formatMoney(value, ledger.currencyCode);
    return (
        <div>
            <div className="grid gap-px border-b bg-border sm:grid-cols-2 xl:grid-cols-4">
                <StatementMetric label="Opening balance" value={balanceLabel(ledger.openingBalance, money)} />
                <StatementMetric label="Period debit" value={money(ledger.periodDebit)} tone="debit" />
                <StatementMetric label="Period credit" value={money(ledger.periodCredit)} tone="credit" />
                <StatementMetric label="Closing balance" value={balanceLabel(ledger.closingBalance, money)} strong />
            </div>
            <div className="overflow-x-auto">
                <Table className="min-w-[900px]">
                    <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Voucher</TableHead><TableHead>Narration / party</TableHead><TableHead className="text-end">Debit</TableHead><TableHead className="text-end">Credit</TableHead><TableHead className="text-end">Balance</TableHead></TableRow></TableHeader>
                    <TableBody>
                        <TableRow className="bg-muted/30"><TableCell>{shortDate(ledger.startDate)}</TableCell><TableCell className="font-medium">Opening</TableCell><TableCell className="text-muted-foreground">Balance brought forward</TableCell><TableCell /><TableCell /><TableCell className="text-end font-bold tabular-nums">{balanceLabel(ledger.openingBalance, money)}</TableCell></TableRow>
                        {ledger.entries.map((entry) => (
                            <TableRow key={`${entry.voucherId}-${entry.voucherNumber}`} className={entry.status === "Reversed" ? "bg-muted/20 text-muted-foreground" : undefined}>
                                <TableCell className="whitespace-nowrap">{shortDate(entry.voucherDate)}</TableCell>
                                <TableCell><p className="font-mono text-xs font-bold text-primary">{entry.voucherNumber}</p><p className="text-[11px] text-muted-foreground">{voucherLabel(entry.voucherType)}</p></TableCell>
                                <TableCell className="max-w-96"><p className="font-medium">{entry.counterpartyName ?? entry.memo}</p>{entry.counterpartyName ? <p className="truncate text-xs text-muted-foreground">{entry.memo}</p> : null}</TableCell>
                                <TableCell className="text-end tabular-nums">{entry.debit ? money(entry.debit) : "—"}</TableCell>
                                <TableCell className="text-end tabular-nums">{entry.credit ? money(entry.credit) : "—"}</TableCell>
                                <TableCell className="text-end font-semibold tabular-nums">{balanceLabel(entry.balance, money)}</TableCell>
                            </TableRow>
                        ))}
                        {!ledger.entries.length ? <TableRow><TableCell colSpan={6} className="h-28 text-center text-muted-foreground">No account movement in this period.</TableCell></TableRow> : null}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

function PartyLedgersWorkspace() {
    const { user } = useAdminAuth();
    const canViewCustomers = hasPermission(user, Permissions.ManualSalesView) && hasPermission(user, Permissions.FinancialReportsView);
    const canViewSuppliers = hasPermission(user, Permissions.PurchasesView);
    const [partyType, setPartyType] = useState<"customer" | "supplier">(canViewCustomers ? "customer" : "supplier");
    const [customer, setCustomer] = useState<OperationCustomer | null>(null);
    const [supplier, setSupplier] = useState<Supplier | null>(null);
    const supplierLedger = useQuery({
        queryKey: ["operations", "supplier-ledger", supplier?.id],
        queryFn: async () => (await operationsService.supplierLedger(supplier!.id)).data,
        enabled: Boolean(supplier),
    });

    return (
        <div className="space-y-5 p-4 sm:p-5">
            <div className="flex flex-col gap-4 border-b pb-5 xl:flex-row xl:items-end xl:justify-between">
                <div>
                    <h2 className="font-heading text-lg font-bold">Customer & supplier ledgers</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Choose a business party to review invoices, payments, and the amount receivable or payable.</p>
                </div>
                <div className="flex border p-1">
                    {canViewCustomers ? <Button variant={partyType === "customer" ? "default" : "ghost"} size="sm" onClick={() => setPartyType("customer")}><UsersRound />Customer</Button> : null}
                    {canViewSuppliers ? <Button variant={partyType === "supplier" ? "default" : "ghost"} size="sm" onClick={() => setPartyType("supplier")}><Building2 />Supplier</Button> : null}
                </div>
            </div>

            {partyType === "customer" && canViewCustomers ? (
                <div className="space-y-5">
                    <div className="max-w-xl space-y-2"><Label>Customer account</Label><ServerSearchCombobox<OperationCustomer> value={customer} onValueChange={setCustomer} queryKey={["accounting", "customer-search"]} search={(term) => operationsService.customers(term, 30)} getLabel={(item) => item.name} getDescription={(item) => `${item.phone || "No phone"} · Outstanding ${item.outstandingDebt.toLocaleString()}`} placeholder="Search customer name or phone…" /></div>
                    {customer ? <CustomerLedgerCard customerId={customer.id} customerName={customer.name} whatsAppUrl={customer.whatsAppUrl} /> : <PartyEmpty icon={<UsersRound />} title="Select a customer" text="Their sales, receipts, opening balance, closing balance, profit, PDF, and Excel statement will appear here." />}
                </div>
            ) : null}

            {partyType === "supplier" && canViewSuppliers ? (
                <div className="space-y-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div className="w-full max-w-xl space-y-2"><Label>Supplier account</Label><ServerSearchCombobox<Supplier> value={supplier} onValueChange={setSupplier} queryKey={["accounting", "supplier-search"]} search={(term) => operationsService.suppliers(term, 30)} getLabel={(item) => item.name} getDescription={(item) => [item.contactPerson, item.phone].filter(Boolean).join(" · ") || "Supplier account"} placeholder="Search supplier or company…" /></div>
                        <Button variant="outline" render={<Link to="/operations/purchases" />}><ArrowRight />Open purchases</Button>
                    </div>
                    {supplierLedger.isLoading ? <div className="grid h-64 place-items-center"><LoaderCircle className="size-6 animate-spin" /></div> : supplierLedger.data ? <SupplierStatement ledger={supplierLedger.data} /> : supplierLedger.isError ? <div className="border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{getApiErrorMessage(supplierLedger.error, "The supplier ledger could not be loaded.")}</div> : <PartyEmpty icon={<Building2 />} title="Select a supplier" text="Purchases, payments, and the running payable balance will appear here." />}
                </div>
            ) : null}

            {!canViewCustomers && !canViewSuppliers ? <PartyEmpty icon={<ShieldCheck />} title="Ledger access is restricted" text="Financial reports or purchase-view permission is required to open party ledgers." /> : null}
        </div>
    );
}

function SupplierStatement({ ledger }: { ledger: SupplierLedger }) {
    const { formatMoney } = useCompany();
    const money = (value: number) => formatMoney(value, ledger.currencyCode);
    return (
        <div className="overflow-hidden border">
            <div className="flex flex-col gap-3 border-b bg-muted/20 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Supplier statement</p><h3 className="mt-1 font-heading text-xl font-bold">{ledger.supplierName}</h3></div><Badge variant="outline">{ledger.currencyCode}</Badge></div>
            <div className="grid gap-px bg-border sm:grid-cols-3"><StatementMetric label="Purchases" value={money(ledger.totalPurchases)} tone="debit" /><StatementMetric label="Payments" value={money(ledger.totalPayments)} tone="credit" /><StatementMetric label="Balance payable" value={money(ledger.closingBalance)} strong /></div>
            <div className="overflow-x-auto"><Table className="min-w-[780px]"><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Reference</TableHead><TableHead>Description</TableHead><TableHead className="text-end">Debit</TableHead><TableHead className="text-end">Credit</TableHead><TableHead className="text-end">Balance</TableHead></TableRow></TableHeader><TableBody>{ledger.entries.map((entry, index) => <TableRow key={`${entry.type}-${entry.sourceId}-${index}`}><TableCell>{shortDate(entry.date)}</TableCell><TableCell><Badge variant="outline">{entry.type}</Badge></TableCell><TableCell className="font-medium">{entry.reference}</TableCell><TableCell className="text-muted-foreground">{entry.description}</TableCell><TableCell className="text-end tabular-nums">{entry.debit ? money(entry.debit) : "—"}</TableCell><TableCell className="text-end tabular-nums">{entry.credit ? money(entry.credit) : "—"}</TableCell><TableCell className="text-end font-semibold tabular-nums">{money(entry.balance)}</TableCell></TableRow>)}{!ledger.entries.length ? <TableRow><TableCell colSpan={7} className="h-28 text-center text-muted-foreground">No supplier activity yet.</TableCell></TableRow> : null}</TableBody></Table></div>
        </div>
    );
}

function VoucherDetailDialog({ voucher, canManage, onOpenChange, onReverse }: { voucher: JournalVoucher | null; canManage: boolean; onOpenChange: (open: boolean) => void; onReverse: (voucher: JournalVoucher) => void }) {
    const { formatMoney, company } = useCompany();
    const [downloading, setDownloading] = useState(false);
    if (!voucher) return null;
    const money = (value: number) => formatMoney(value, voucher.currencyCode);
    const canReverse = canManage && !voucher.isSystemGenerated && voucher.status === "Posted" && voucher.voucherType !== "Reversal";
    const download = async () => {
        setDownloading(true);
        try {
            await operationsService.downloadJournalVoucher(voucher.id);
            toast.success(`Voucher ${voucher.voucherNumber} PDF generated.`);
        } catch (error) {
            toast.error(getApiErrorMessage(error, "The voucher PDF could not be generated."));
        } finally {
            setDownloading(false);
        }
    };
    return (
        <Dialog open onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-5xl">
                <DialogHeader>
                    <DialogTitle>Voucher document</DialogTitle>
                    <DialogDescription>A complete, printable double-entry record with source and operator audit details.</DialogDescription>
                </DialogHeader>
                <div className="border bg-background">
                    <div className="company-gradient flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-start sm:justify-between">
                        <div><p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{company?.name ?? "Company"}</p><h2 className="mt-2 font-heading text-2xl font-bold">Journal voucher</h2><p className="mt-1 text-sm text-muted-foreground">{voucherLabel(voucher.voucherType)} · {voucher.isSystemGenerated ? "Workflow generated" : "Controlled adjustment"}</p></div>
                        <div className="text-start sm:text-end"><p className="font-mono text-lg font-bold text-primary">{voucher.voucherNumber}</p><p className="mt-1 text-sm">{shortDate(voucher.voucherDate)}</p><div className="mt-2 flex gap-2 sm:justify-end"><Badge variant="outline">{voucher.currencyCode}</Badge><Badge variant={voucher.status === "Posted" ? "default" : "secondary"}>{voucher.status}</Badge></div></div>
                    </div>
                    <div className="grid gap-px border-b bg-border sm:grid-cols-2 xl:grid-cols-4"><DocumentInfo label="Source document" value={voucher.sourceNumber ?? "Controlled entry"} /><DocumentInfo label="External reference" value={voucher.referenceNumber ?? "—"} /><DocumentInfo label="Party" value={voucher.counterpartyName ?? "Company accounts"} /><DocumentInfo label="Posted by" value={voucher.operatorName ?? "System"} /></div>
                    <div className="border-b p-5"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Business narration</p><p className="mt-2 text-sm leading-6">{voucher.memo}</p></div>
                    <div className="overflow-x-auto"><Table className="min-w-[760px]"><TableHeader><TableRow><TableHead className="w-28">Account</TableHead><TableHead>Account name</TableHead><TableHead>Description</TableHead><TableHead className="text-end">Debit</TableHead><TableHead className="text-end">Credit</TableHead></TableRow></TableHeader><TableBody>{voucher.lines.map((line) => <TableRow key={line.id}><TableCell className="font-mono font-bold">{line.accountCode}</TableCell><TableCell className="font-medium">{line.accountName}</TableCell><TableCell className="text-muted-foreground">{line.description ?? "—"}</TableCell><TableCell className="text-end tabular-nums">{line.debit ? money(line.debit) : "—"}</TableCell><TableCell className="text-end tabular-nums">{line.credit ? money(line.credit) : "—"}</TableCell></TableRow>)}<TableRow className="bg-muted/30 font-bold"><TableCell colSpan={3} className="text-end">Balanced totals</TableCell><TableCell className="text-end tabular-nums">{money(voucher.totalDebit)}</TableCell><TableCell className="text-end tabular-nums">{money(voucher.totalCredit)}</TableCell></TableRow></TableBody></Table></div>
                    <div className="grid gap-px border-t bg-border sm:grid-cols-3"><DocumentInfo label="Posted at" value={dateTime(voucher.postedAt)} /><DocumentInfo label="Entry integrity" value={Math.abs(voucher.totalDebit - voucher.totalCredit) < 0.01 ? "Balanced · verified" : "Review required"} /><DocumentInfo label="Audit policy" value="Immutable · reversal only" /></div>
                    {voucher.reversalReason ? <div className="border-t border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"><strong>Reversal reason:</strong> {voucher.reversalReason}</div> : null}
                </div>
                <DialogFooter className="sm:justify-between">
                    <div>{canReverse ? <Button variant="destructive" onClick={() => onReverse(voucher)}><RotateCcw />Reverse voucher</Button> : null}</div>
                    <div className="flex gap-2"><Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button><Button disabled={downloading} onClick={() => void download()}>{downloading ? <LoaderCircle className="animate-spin" /> : <FileText />}Download PDF</Button></div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function AdjustmentDialog({ open, accounts, currencies, onOpenChange, onSaved }: { open: boolean; accounts: JournalAccountBalance[]; currencies: string[]; onOpenChange: (open: boolean) => void; onSaved: () => Promise<void> }) {
    const { formatMoney, company } = useCompany();
    const [voucherDate, setVoucherDate] = useState(() => localDate(new Date()));
    const [currencyCode, setCurrencyCode] = useState(company?.settings.mainCurrencyCode ?? currencies[0] ?? "AFN");
    const [voucherType, setVoucherType] = useState<ManualVoucherType>("ManualAdjustment");
    const [referenceNumber, setReferenceNumber] = useState("");
    const [memo, setMemo] = useState("");
    const [lines, setLines] = useState<DraftLine[]>([newLine(), newLine()]);
    const accountOptions = useMemo(() => {
        const available = new Map<string, { code: string; name: string }>(
            standardAccounts.map((account) => [account.code, account]),
        );
        accounts
            .filter((account) => account.currencyCode === currencyCode)
            .forEach((account) => available.set(account.accountCode, { code: account.accountCode, name: account.accountName }));
        return Array.from(available.values()).sort((left, right) => left.code.localeCompare(right.code));
    }, [accounts, currencyCode]);
    const totals = useMemo(() => ({ debit: lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0), credit: lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0) }), [lines]);
    const difference = Math.abs(totals.debit - totals.credit);
    const balanced = totals.debit > 0 && difference < 0.01;
    const money = (value: number) => formatMoney(value, currencyCode);
    const reset = () => { setVoucherDate(localDate(new Date())); setCurrencyCode(company?.settings.mainCurrencyCode ?? currencies[0] ?? "AFN"); setVoucherType("ManualAdjustment"); setReferenceNumber(""); setMemo(""); setLines([newLine(), newLine()]); };
    const create = useMutation({ mutationFn: (body: CreateJournalVoucher) => operationsService.createJournalVoucher(body), onSuccess: async (response) => { await onSaved(); toast.success(`Voucher ${response.data.voucherNumber} posted.`); reset(); onOpenChange(false); }, onError: (error) => toast.error(getApiErrorMessage(error, "The adjustment voucher could not be posted.")) });
    const applyTemplate = (template: typeof voucherTemplates[number]) => { setVoucherType(template.type); setMemo(template.memo); setLines([templateLine(template.debit, "Debit entry"), templateLine(template.credit, "Matching credit entry")]); };
    const submit = () => {
        if (!memo.trim()) return invalid("voucher-memo", "A clear business narration is required.");
        const invalidIndex = lines.findIndex((line) => !line.accountCode.trim() || !line.accountName.trim() || line.debit < 0 || line.credit < 0 || (line.debit > 0) === (line.credit > 0));
        if (invalidIndex >= 0) return invalid(`journal-line-${invalidIndex}`, `Line ${invalidIndex + 1} needs an account and either one debit or one credit amount.`);
        if (!balanced) return toast.error(`Voucher is not balanced. Difference: ${money(difference)}.`);
        create.mutate({ voucherDate, currencyCode, voucherType, memo: memo.trim(), referenceNumber: referenceNumber.trim() || null, lines: lines.map(({ key: _, ...line }) => ({ ...line, description: line.description?.trim() || null })) });
    };
    return (
        <Dialog open={open} onOpenChange={(next) => !create.isPending && onOpenChange(next)}>
            <DialogContent className="sm:max-w-6xl">
                <DialogHeader><DialogTitle>New controlled voucher</DialogTitle><DialogDescription>Use this for opening balances, internal transfers, equity, accruals, and documented corrections. Sales, purchases, payments, expenses, and payroll should be recorded in their source screens.</DialogDescription></DialogHeader>
                <div className="border border-primary/20 bg-primary/5 p-3"><p className="text-xs font-semibold text-primary">Quick templates</p><div className="mt-2 flex flex-wrap gap-2">{voucherTemplates.map((template) => <Button key={template.title} type="button" size="sm" variant="outline" onClick={() => applyTemplate(template)}>{template.title}</Button>)}</div></div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[230px_170px_140px_210px_1fr]">
                    <Field label="Purpose *"><SimpleCombobox<string> value={voucherType} onValueChange={(value) => setVoucherType((value ?? "ManualAdjustment") as ManualVoucherType)} options={manualTypes.map((item) => ({ value: item.value, label: item.label, description: item.description }))} placeholder="Select purpose" /></Field>
                    <Field label="Voucher date"><Input type="date" value={voucherDate} onChange={(event) => setVoucherDate(event.target.value)} /></Field>
                    <Field label="Currency"><SimpleCombobox<string> value={currencyCode} onValueChange={(value) => setCurrencyCode(value ?? currencies[0] ?? "AFN")} options={currencies.map((code) => ({ value: code, label: code }))} /></Field>
                    <Field label="External reference"><Input value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} placeholder="Optional document ref" /></Field>
                    <Field label="Business narration *"><Textarea id="voucher-memo" className="min-h-9" value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="Purpose and supporting document" /></Field>
                </div>
                <p className="text-xs text-muted-foreground">{manualTypes.find((item) => item.value === voucherType)?.description}</p>
                <div className="overflow-x-auto border">
                    <div className="md:min-w-[950px]">
                        <div className="hidden grid-cols-[45px_170px_180px_1fr_140px_140px_45px] gap-2 border-b bg-muted/50 p-2 text-xs font-bold md:grid"><span>#</span><span>Account code</span><span>Account name</span><span>Line description</span><span className="text-end">Debit</span><span className="text-end">Credit</span><span /></div>
                        {lines.map((line, index) => <JournalLine key={line.key} id={`journal-line-${index}`} line={line} index={index} accounts={accountOptions} onChange={(next) => setLines((current) => current.map((item) => item.key === line.key ? next : item))} onRemove={() => setLines((current) => current.length > 2 ? current.filter((item) => item.key !== line.key) : current)} />)}
                        <div className="grid grid-cols-2 gap-2 bg-muted/30 p-3 text-sm font-bold md:grid-cols-[1fr_140px_140px_45px]"><span className="col-span-2 md:col-span-1 md:text-end">Totals · {currencyCode}</span><span className="tabular-nums md:text-end"><span className="block text-[10px] font-medium text-muted-foreground md:hidden">Debit</span>{money(totals.debit)}</span><span className="text-end tabular-nums"><span className="block text-[10px] font-medium text-muted-foreground md:hidden">Credit</span>{money(totals.credit)}</span><span className="hidden md:block" /></div>
                    </div>
                </div>
                <DialogFooter className="sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2"><Button variant="outline" onClick={() => setLines((current) => [...current, newLine()])}><Plus />Add account line</Button><Badge variant={balanced ? "default" : "destructive"}><Scale className="size-3" />{balanced ? "Balanced" : totals.debit <= 0 && totals.credit <= 0 ? "Amounts required" : `Difference ${money(difference)}`}</Badge></div>
                    <div className="flex gap-2"><Button variant="outline" disabled={create.isPending} onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={create.isPending || !balanced} onClick={submit}>{create.isPending ? <LoaderCircle className="animate-spin" /> : <Save />}{create.isPending ? "Posting…" : "Post voucher"}</Button></div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function JournalLine({ id, line, index, accounts, onChange, onRemove }: { id: string; line: DraftLine; index: number; accounts: { code: string; name: string }[]; onChange: (line: DraftLine) => void; onRemove: () => void }) {
    const field = <K extends keyof DraftLine>(key: K, value: DraftLine[K]) => onChange({ ...line, [key]: value });
    return <div id={id} className="grid scroll-mt-24 grid-cols-2 gap-3 border-b p-3 last:border-b-0 md:grid-cols-[45px_170px_180px_1fr_140px_140px_45px] md:gap-2 md:p-2"><span className="col-span-2 self-center text-sm font-semibold text-muted-foreground md:col-span-1 md:text-center">Line {index + 1}</span><JournalInput label="Account code"><SimpleCombobox<string> value={line.accountCode || null} onValueChange={(accountCode) => { const account = accounts.find((item) => item.code === accountCode); onChange({ ...line, accountCode: account?.code ?? "", accountName: account?.name ?? "" }); }} options={accounts.map((account) => ({ value: account.code, label: account.code, description: account.name }))} placeholder="Select account…" emptyText="No matching account found." /></JournalInput><JournalInput label="Account name"><Input aria-label={`Line ${index + 1} account name`} value={line.accountName} onChange={(event) => field("accountName", event.target.value)} placeholder="Cash on Hand" /></JournalInput><JournalInput label="Description" className="col-span-2 md:col-span-1"><Input aria-label={`Line ${index + 1} description`} value={line.description ?? ""} onChange={(event) => field("description", event.target.value)} placeholder="What this line represents" /></JournalInput><JournalInput label="Debit"><Input aria-label={`Line ${index + 1} debit`} className="text-end" type="number" min={0} step="0.01" value={line.debit || ""} onChange={(event) => { const debit = Number(event.target.value); onChange({ ...line, debit, credit: debit > 0 ? 0 : line.credit }); }} /></JournalInput><JournalInput label="Credit"><Input aria-label={`Line ${index + 1} credit`} className="text-end" type="number" min={0} step="0.01" value={line.credit || ""} onChange={(event) => { const credit = Number(event.target.value); onChange({ ...line, credit, debit: credit > 0 ? 0 : line.debit }); }} /></JournalInput><Button className="col-span-2 justify-self-end md:col-span-1" size="icon" variant="ghost" title={`Remove line ${index + 1}`} onClick={onRemove}><Trash2 className="size-4 text-destructive" /></Button></div>;
}

function JournalInput({ label, className, children }: { label: string; className?: string; children: ReactNode }) { return <div className={cn("space-y-1", className)}><Label className="text-[11px] text-muted-foreground md:hidden">{label}</Label>{children}</div>; }

function WorkspaceTab({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
    return <button type="button" className={cn("flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground", active ? "border-primary bg-background text-foreground" : "border-transparent")} onClick={onClick}>{icon}{label}</button>;
}
function StatusPill({ icon, text }: { icon: ReactNode; text: string }) { return <span className="flex items-center gap-1.5 border bg-background/80 px-2.5 py-1.5 font-medium text-foreground [&_svg]:size-3.5 [&_svg]:text-primary">{icon}{text}</span>; }
function VoucherTypeBadge({ voucher }: { voucher: JournalVoucher }) { return <Badge variant={voucher.isSystemGenerated ? "outline" : "secondary"} className={voucher.isSystemGenerated ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400" : undefined}>{voucher.isSystemGenerated ? <Bot className="size-3" /> : <FileClock className="size-3" />}{voucherLabel(voucher.voucherType)}</Badge>; }
function Metric({ icon, label, value, help, tone }: { icon: ReactNode; label: string; value: ReactNode; help: string; tone?: "positive" }) { return <Card className="shadow-none"><CardContent className="flex items-start gap-3 p-4"><span className={cn("grid size-10 shrink-0 place-items-center bg-primary/10 text-primary [&_svg]:size-5", tone === "positive" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400")}>{icon}</span><div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 truncate text-xl font-bold tabular-nums">{value}</p><p className="mt-1 truncate text-[11px] text-muted-foreground">{help}</p></div></CardContent></Card>; }
function StatementMetric({ label, value, tone, strong }: { label: string; value: string; tone?: "debit" | "credit"; strong?: boolean }) { return <div className={cn("bg-background p-4", strong && "bg-primary/5")}><p className="text-xs text-muted-foreground">{label}</p><p className={cn("mt-2 text-lg font-bold tabular-nums", tone === "debit" && "text-sky-700 dark:text-sky-400", tone === "credit" && "text-emerald-700 dark:text-emerald-400", strong && "text-primary")}>{value}</p></div>; }
function DocumentInfo({ label, value }: { label: string; value: string }) { return <div className="bg-background p-4"><p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></div>; }
function PartyEmpty({ icon, title, text }: { icon: ReactNode; title: string; text: string }) { return <div className="grid min-h-72 place-items-center border border-dashed bg-muted/10 p-8 text-center"><div><span className="mx-auto grid size-12 place-items-center bg-muted text-muted-foreground [&_svg]:size-6">{icon}</span><p className="mt-4 font-heading text-base font-bold">{title}</p><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">{text}</p></div></div>; }
function templateLine(code: string, description: string): DraftLine { const account = standardAccounts.find((item) => item.code === code); return { key: createUuid(), accountCode: code, accountName: account?.name ?? "", description, debit: 0, credit: 0 }; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
function shortDate(value: string | null | undefined) { if (!value) return "Date unavailable"; const parsed = new Date(`${value.slice(0, 10)}T00:00:00Z`); return Number.isNaN(parsed.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" }).format(parsed); }
function dateTime(value: string | null | undefined) { if (!value) return "Not recorded"; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? "Not recorded" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(parsed); }
function invalid(id: string, text: string) { toast.error(text); document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" }); document.getElementById(id)?.querySelector<HTMLElement>("input,textarea")?.focus(); }
function voucherLabel(type: JournalVoucherType) { return voucherTypes.find((item) => item.value === type)?.label ?? type; }
function sourceHref(voucher: JournalVoucher) { if (!voucher.sourceType || !voucher.sourceId) return null; if (voucher.sourceType === "OnlineOrder") return `/orders/${voucher.sourceId}`; if (voucher.sourceType === "OnlinePayment") return voucher.sourceNumber ? `/orders?search=${encodeURIComponent(voucher.sourceNumber)}` : "/orders"; if (voucher.sourceType === "Purchase" || voucher.sourceType === "PurchasePayment") return "/operations/purchases"; if (voucher.sourceType === "ManualSale" || voucher.sourceType === "SalePayment") return "/operations/sales"; if (voucher.sourceType === "Expense") return "/operations/expenses"; if (voucher.sourceType === "Payroll" || voucher.sourceType === "PayrollPayment") return "/operations/staff"; return null; }
function localDate(value: Date) { const offset = value.getTimezoneOffset(); return new Date(value.getTime() - offset * 60_000).toISOString().slice(0, 10); }
function yearToDate() { const end = new Date(); const start = new Date(end.getFullYear(), 0, 1); return { startDate: localDate(start), endDate: localDate(end) }; }
function currencyOptions(main?: string, values: string[] = []) { return Array.from(new Set([main, ...commonCurrencies, ...values].filter((value): value is string => Boolean(value?.trim())).map((value) => value.toUpperCase()))); }
function balanceLabel(value: number, money: (amount: number) => string) { return value > 0 ? `Dr ${money(value)}` : value < 0 ? `Cr ${money(Math.abs(value))}` : money(0); }
function compactBalance(value: number, money: (amount: number) => string) { return value > 0 ? `Dr ${money(value)}` : value < 0 ? `Cr ${money(Math.abs(value))}` : "—"; }
