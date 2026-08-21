import { useDeferredValue, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, BookOpen, CheckCircle2, FileClock, Landmark, LoaderCircle, Plus, RefreshCw, RotateCcw, Save, Scale, Search, ShieldCheck, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { ListPagination } from "@/components/list-pagination";
import { PageHeader } from "@/components/page-header";
import { SimpleCombobox } from "@/components/simple-combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAdminAuth } from "@/features/auth/auth-context";
import { hasPermission, Permissions } from "@/features/auth/permissions";
import { useCompany } from "@/features/company/company-context";
import { operationsService } from "@/features/operations/operations-service";
import type { CreateJournalVoucher, JournalVoucher, JournalVoucherStatus, JournalVoucherType } from "@/features/operations/operations-types";
import { getApiErrorMessage } from "@/lib/api-error";
import { createUuid } from "@/lib/create-uuid";

type DraftLine = CreateJournalVoucher["lines"][number] & { key: string };
type ManualVoucherType = CreateJournalVoucher["voucherType"];

const newLine = (): DraftLine => ({ key: createUuid(), accountCode: "", accountName: "", description: null, debit: 0, credit: 0 });

const standardAccounts = [
    { code: "1000", name: "Cash on Hand" }, { code: "1010", name: "Bank Account" },
    { code: "1100", name: "Accounts Receivable" }, { code: "1200", name: "Inventory" },
    { code: "1300", name: "Prepaid Expenses" }, { code: "1500", name: "Fixed Assets" },
    { code: "2000", name: "Accounts Payable" }, { code: "2050", name: "Customer Credit and Deposits" },
    { code: "2100", name: "Accrued Expenses" }, { code: "2200", name: "Payroll Payable" },
    { code: "2300", name: "Sales Tax Payable" }, { code: "3000", name: "Owner Capital" },
    { code: "3100", name: "Owner Drawings" }, { code: "4000", name: "Sales Revenue" },
    { code: "4100", name: "Other Income" }, { code: "4200", name: "Shipping Revenue" },
    { code: "5000", name: "Cost of Goods Sold" }, { code: "6000", name: "Operating Expense" },
    { code: "6100", name: "Salary Expense" }, { code: "6200", name: "Rent Expense" },
    { code: "6300", name: "Utilities Expense" },
] as const;

const voucherTypes: { value: JournalVoucherType; label: string }[] = [
    { value: "Purchase", label: "Purchase accrual" }, { value: "PurchasePayment", label: "Supplier payment" },
    { value: "ManualSale", label: "Manual sale" }, { value: "SaleReceipt", label: "Customer receipt" },
    { value: "OnlineSale", label: "Online sale" }, { value: "OnlineReceipt", label: "Online receipt" }, { value: "Expense", label: "Expense payment" },
    { value: "PayrollAccrual", label: "Payroll accrual" }, { value: "PayrollPayment", label: "Payroll payment" },
    { value: "ManualAdjustment", label: "Manual adjustment" }, { value: "OpeningBalance", label: "Opening balance" },
    { value: "FundsTransfer", label: "Funds transfer" }, { value: "OwnerEquity", label: "Owner equity" },
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

export default function JournalVouchersPage() {
    const queryClient = useQueryClient();
    const { formatMoney } = useCompany();
    const { user } = useAdminAuth();
    const canManage = hasPermission(user, Permissions.ExpensesManage);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [search, setSearch] = useState("");
    const deferredSearch = useDeferredValue(search.trim());
    const [type, setType] = useState<JournalVoucherType | "all">("all");
    const [status, setStatus] = useState<JournalVoucherStatus | "all">("all");
    const [origin, setOrigin] = useState<"all" | "system" | "manual">("all");
    const [adjustmentOpen, setAdjustmentOpen] = useState(false);
    const [reverseVoucher, setReverseVoucher] = useState<JournalVoucher | null>(null);
    const [reversalReason, setReversalReason] = useState("");

    const params = { search: deferredSearch || undefined, type: type === "all" ? undefined : type, status: status === "all" ? undefined : status, systemGenerated: origin === "all" ? undefined : origin === "system", page, pageSize };
    const query = useQuery({ queryKey: ["journal-vouchers", params], queryFn: async () => (await operationsService.journalVouchers(params)).data });
    const summary = useQuery({ queryKey: ["journal-vouchers", "summary"], queryFn: async () => (await operationsService.journalVoucherSummary()).data });
    const accountBalances = useQuery({ queryKey: ["journal-vouchers", "accounts"], queryFn: async () => (await operationsService.journalAccountBalances()).data });
    const refreshAccounting = async () => { await queryClient.invalidateQueries({ queryKey: ["journal-vouchers"] }); };
    const sync = useMutation({
        mutationFn: operationsService.syncJournalVouchers,
        onSuccess: async (response) => { await refreshAccounting(); toast.success(response.data.createdVouchers ? `${response.data.createdVouchers} missing operational vouchers were created.` : "Accounting is already synchronized with every operational transaction."); },
        onError: (error) => toast.error(getApiErrorMessage(error, "The operational vouchers could not be synchronized.")),
    });
    const reverse = useMutation({
        mutationFn: ({ id, reason }: { id: number; reason: string }) => operationsService.reverseJournalVoucher(id, reason),
        onSuccess: async (response) => { await refreshAccounting(); toast.success(`Reversal ${response.data.voucherNumber} was posted.`); setReverseVoucher(null); setReversalReason(""); },
        onError: (error) => toast.error(getApiErrorMessage(error, "The voucher could not be reversed.")),
    });
    const resetPage = () => setPage(1);

    return <div className="space-y-6">
        <PageHeader title="Accounting vouchers" description="A source-linked double-entry ledger generated from your real sales, purchases, receipts, supplier payments, expenses, payroll, and delivered online orders." actions={canManage ? <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={sync.isPending} onClick={() => sync.mutate()}>{sync.isPending ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}{sync.isPending ? "Synchronizing…" : "Sync existing transactions"}</Button><Button onClick={() => setAdjustmentOpen(true)}><Plus />New adjustment</Button></div> : undefined} />

        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.055] p-4"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-700 dark:text-emerald-400" /><div><p className="font-semibold">Operational vouchers are automatic and source-controlled.</p><p className="mt-1 text-sm text-muted-foreground">Record business activity once in its proper screen. This ledger posts the balanced accounting entry, keeps the customer, supplier, staff member, source document, and operator attached, and prevents duplicate postings. Manual adjustments are reserved for opening balances, transfers, equity, and documented corrections.</p></div></div></div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><Metric icon={<BookOpen />} label="Total vouchers" value={summary.data?.totalVouchers ?? 0} /><Metric icon={<Bot />} label="Workflow generated" value={summary.data?.systemGeneratedVouchers ?? 0} tone="positive" /><Metric icon={<FileClock />} label="Controlled adjustments" value={summary.data?.manualVouchers ?? 0} /><Metric icon={<RotateCcw />} label="Reversed" value={summary.data?.reversedVouchers ?? 0} tone="warning" /><Metric icon={<Landmark />} label={`${summary.data?.currencyCode ?? "Base currency"} posted debits`} value={formatMoney(summary.data?.totalPostedDebits ?? 0, summary.data?.currencyCode)} /></div>

        <Card className="shadow-none">
            <CardHeader className="border-b"><CardTitle>Voucher ledger</CardTitle><p className="text-sm text-muted-foreground">Search by voucher, source document, reference, customer, supplier, staff member, or memo.</p></CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6"><div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_220px_180px_180px]"><div className="relative"><Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="ps-9" value={search} onChange={(event) => { setSearch(event.target.value); resetPage(); }} placeholder="Voucher, source, party, reference…" /></div><SimpleCombobox<string> value={type} onValueChange={(value) => { setType((value ?? "all") as JournalVoucherType | "all"); resetPage(); }} options={[{ value: "all", label: "All voucher types" }, ...voucherTypes]} placeholder="All voucher types" /><SimpleCombobox<string> value={origin} onValueChange={(value) => { setOrigin((value ?? "all") as typeof origin); resetPage(); }} options={[{ value: "all", label: "All origins" }, { value: "system", label: "Workflow generated" }, { value: "manual", label: "Manual adjustment" }]} placeholder="All origins" /><SimpleCombobox<string> value={status} onValueChange={(value) => { setStatus((value ?? "all") as JournalVoucherStatus | "all"); resetPage(); }} options={[{ value: "all", label: "All statuses" }, { value: "Posted", label: "Posted" }, { value: "Reversed", label: "Reversed" }]} placeholder="All statuses" /></div></CardContent>
            <div className="overflow-x-auto border-t"><Table className="min-w-[1180px]"><TableHeader><TableRow><TableHead>Date / voucher</TableHead><TableHead>Type</TableHead><TableHead>Source</TableHead><TableHead>Customer / company / staff</TableHead><TableHead>Operator</TableHead><TableHead>Status</TableHead><TableHead className="text-end">Amount</TableHead><TableHead className="w-12" /></TableRow></TableHeader><TableBody>{query.isLoading ? <TableRow><TableCell colSpan={8} className="h-32 text-center"><LoaderCircle className="mx-auto size-5 animate-spin" /></TableCell></TableRow> : query.data?.items.length ? query.data.items.map((voucher) => <VoucherRow key={voucher.id} voucher={voucher} money={(value) => formatMoney(value, voucher.currencyCode)} canManage={canManage} onReverse={setReverseVoucher} />) : <TableRow><TableCell colSpan={8} className="h-32 text-center text-muted-foreground">No vouchers match these filters. Use “Sync existing transactions” once to build the ledger from historical operations.</TableCell></TableRow>}</TableBody></Table></div>
            <ListPagination page={page} pageSize={pageSize} totalCount={query.data?.totalCount ?? 0} totalPages={query.data?.totalPages} disabled={query.isLoading} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
        </Card>

        <Card className="overflow-hidden shadow-none"><CardHeader><CardTitle>General ledger account balances</CardTitle><p className="text-sm text-muted-foreground">Consolidated debit, credit, and balance totals from automatic workflow postings and controlled adjustments. Each currency is kept separate.</p></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><Table className="min-w-[820px]"><TableHeader><TableRow><TableHead>Account</TableHead><TableHead>Name</TableHead><TableHead>Currency</TableHead><TableHead>Entries</TableHead><TableHead className="text-end">Debits</TableHead><TableHead className="text-end">Credits</TableHead><TableHead className="text-end">Balance</TableHead></TableRow></TableHeader><TableBody>{accountBalances.isLoading ? <TableRow><TableCell colSpan={7} className="h-24 text-center"><LoaderCircle className="mx-auto size-5 animate-spin" /></TableCell></TableRow> : accountBalances.data?.length ? accountBalances.data.map((account) => <TableRow key={`${account.accountCode}-${account.currencyCode}`}><TableCell className="font-mono font-semibold">{account.accountCode}</TableCell><TableCell>{account.accountName}</TableCell><TableCell><Badge variant="outline">{account.currencyCode}</Badge></TableCell><TableCell>{account.entryCount}</TableCell><TableCell className="text-end tabular-nums">{formatMoney(account.totalDebit, account.currencyCode)}</TableCell><TableCell className="text-end tabular-nums">{formatMoney(account.totalCredit, account.currencyCode)}</TableCell><TableCell className="text-end font-semibold tabular-nums">{account.balance > 0 ? `Dr ${formatMoney(account.balance, account.currencyCode)}` : account.balance < 0 ? `Cr ${formatMoney(Math.abs(account.balance), account.currencyCode)}` : formatMoney(0, account.currencyCode)}</TableCell></TableRow>) : <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Synchronize operational transactions to build the general ledger.</TableCell></TableRow>}</TableBody></Table></div></CardContent></Card>

        <AdjustmentDialog open={adjustmentOpen} onOpenChange={setAdjustmentOpen} onSaved={refreshAccounting} />
        <Dialog open={Boolean(reverseVoucher)} onOpenChange={(open) => { if (!open && !reverse.isPending) { setReverseVoucher(null); setReversalReason(""); } }}><DialogContent><DialogHeader><DialogTitle>Reverse {reverseVoucher?.voucherNumber}</DialogTitle><DialogDescription>A posted voucher is never deleted. The system will create a new voucher with debit and credit reversed, preserving the complete audit history.</DialogDescription></DialogHeader><div className="space-y-2"><Label>Reversal reason *</Label><Textarea value={reversalReason} onChange={(event) => setReversalReason(event.target.value)} placeholder="Explain why this accounting entry must be reversed" /></div><DialogFooter><Button variant="outline" disabled={reverse.isPending} onClick={() => setReverseVoucher(null)}>Cancel</Button><Button variant="destructive" disabled={reverse.isPending || !reversalReason.trim()} onClick={() => reverseVoucher && reverse.mutate({ id: reverseVoucher.id, reason: reversalReason.trim() })}>{reverse.isPending ? <LoaderCircle className="animate-spin" /> : <RotateCcw />}Post reversal</Button></DialogFooter></DialogContent></Dialog>
    </div>;
}

function VoucherRow({ voucher, money, canManage, onReverse }: { voucher: JournalVoucher; money: (value: number) => string; canManage: boolean; onReverse: (voucher: JournalVoucher) => void }) {
    const href = sourceHref(voucher);
    const canReverse = canManage && !voucher.isSystemGenerated && voucher.status === "Posted" && voucher.voucherType !== "Reversal";
    return <TableRow className={voucher.status === "Reversed" ? "bg-muted/20 text-muted-foreground" : undefined}><TableCell><p>{date(voucher.voucherDate)}</p><p className="font-mono text-xs font-semibold">{voucher.voucherNumber}</p>{voucher.referenceNumber ? <p className="text-[11px] text-muted-foreground">Ref: {voucher.referenceNumber}</p> : null}</TableCell><TableCell><VoucherTypeBadge voucher={voucher} /></TableCell><TableCell>{voucher.sourceNumber ? href ? <Link className="font-semibold text-primary hover:underline" to={href}>{voucher.sourceNumber}</Link> : <span className="font-semibold">{voucher.sourceNumber}</span> : <span className="text-muted-foreground">Controlled adjustment</span>}<p className="text-[11px] text-muted-foreground">{voucher.sourceType ?? voucherLabel(voucher.voucherType)}</p></TableCell><TableCell>{voucher.counterpartyName ? <><p className="font-medium">{voucher.counterpartyName}</p><p className="text-[11px] text-muted-foreground">{voucher.counterpartyType}</p></> : <span className="text-muted-foreground">—</span>}</TableCell><TableCell>{voucher.operatorName ?? "System"}<p className="text-[11px] text-muted-foreground">{dateTime(voucher.postedAt)}</p></TableCell><TableCell><Badge variant={voucher.status === "Posted" ? "default" : "secondary"}>{voucher.status === "Posted" ? <CheckCircle2 className="size-3" /> : <RotateCcw className="size-3" />}{voucher.status}</Badge>{voucher.reversalReason ? <p className="mt-1 max-w-44 text-[11px]" title={voucher.reversalReason}>{voucher.reversalReason}</p> : null}</TableCell><TableCell className="text-end"><p className="font-bold tabular-nums">{money(voucher.totalDebit)}</p><details className="mt-1 text-start"><summary className="cursor-pointer text-xs text-primary">{voucher.lines.length} balanced lines</summary><div className="mt-2 min-w-80 space-y-1 rounded-lg bg-muted/50 p-2 text-xs">{voucher.lines.map((line) => <p key={line.id} className="flex justify-between gap-3"><span>{line.accountCode} · {line.accountName}</span><span className="font-medium tabular-nums">{line.debit > 0 ? `Dr ${money(line.debit)}` : `Cr ${money(line.credit)}`}</span></p>)}<p className="border-t pt-1 text-muted-foreground">{voucher.memo}</p></div></details></TableCell><TableCell>{canReverse ? <Button size="icon" variant="ghost" title="Reverse this manual voucher" onClick={() => onReverse(voucher)}><RotateCcw className="size-4" /></Button> : voucher.isSystemGenerated ? <span title="Correct this voucher from its source workflow"><ShieldCheck className="size-4 text-emerald-600" /></span> : null}</TableCell></TableRow>;
}

function VoucherTypeBadge({ voucher }: { voucher: JournalVoucher }) { return <Badge variant={voucher.isSystemGenerated ? "outline" : "secondary"} className={voucher.isSystemGenerated ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400" : undefined}>{voucher.isSystemGenerated ? <Bot className="size-3" /> : <FileClock className="size-3" />}{voucherLabel(voucher.voucherType)}</Badge>; }

function AdjustmentDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => Promise<void> }) {
    const { formatMoney } = useCompany();
    const [voucherDate, setVoucherDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [voucherType, setVoucherType] = useState<ManualVoucherType>("ManualAdjustment");
    const [referenceNumber, setReferenceNumber] = useState("");
    const [memo, setMemo] = useState("");
    const [lines, setLines] = useState<DraftLine[]>([newLine(), newLine()]);
    const totals = useMemo(() => ({ debit: lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0), credit: lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0) }), [lines]);
    const difference = Math.abs(totals.debit - totals.credit);
    const balanced = totals.debit > 0 && difference < 0.01;
    const reset = () => { setVoucherDate(new Date().toISOString().slice(0, 10)); setVoucherType("ManualAdjustment"); setReferenceNumber(""); setMemo(""); setLines([newLine(), newLine()]); };
    const create = useMutation({ mutationFn: (body: CreateJournalVoucher) => operationsService.createJournalVoucher(body), onSuccess: async (response) => { await onSaved(); toast.success(`Adjustment ${response.data.voucherNumber} posted.`); reset(); onOpenChange(false); }, onError: (error) => toast.error(getApiErrorMessage(error, "The adjustment voucher could not be posted.")) });
    const applyTemplate = (template: typeof voucherTemplates[number]) => { setVoucherType(template.type); setMemo(template.memo); setLines([templateLine(template.debit, "Enter the debit amount"), templateLine(template.credit, "Enter the matching credit amount")]); };
    const submit = () => {
        if (!memo.trim()) return invalid("voucher-memo", "A clear adjustment memo is required.");
        const invalidIndex = lines.findIndex((line) => !line.accountCode.trim() || !line.accountName.trim() || line.debit < 0 || line.credit < 0 || (line.debit > 0) === (line.credit > 0));
        if (invalidIndex >= 0) return invalid(`journal-line-${invalidIndex}`, `Line ${invalidIndex + 1} needs an account and either one debit or one credit amount.`);
        if (!balanced) return toast.error(`Voucher is not balanced. Difference: ${formatMoney(difference)}.`);
        create.mutate({ voucherDate, voucherType, memo: memo.trim(), referenceNumber: referenceNumber.trim() || null, lines: lines.map(({ key: _, ...line }) => ({ ...line, description: line.description?.trim() || null })) });
    };
    return <Dialog open={open} onOpenChange={(next) => !create.isPending && onOpenChange(next)}><DialogContent className="sm:max-w-6xl"><DialogHeader><DialogTitle>Controlled accounting adjustment</DialogTitle><DialogDescription>Use this only when no sale, purchase, payment, expense, payroll, or online-order workflow represents the entry. The posted voucher is immutable and can only be reversed with a reason.</DialogDescription></DialogHeader><div className="flex flex-wrap gap-2">{voucherTemplates.map((template) => <Button key={template.title} type="button" size="sm" variant="outline" onClick={() => applyTemplate(template)}>{template.title}</Button>)}</div><div className="grid gap-4 md:grid-cols-[220px_180px_220px_1fr]"><Field label="Purpose *"><SimpleCombobox<string> value={voucherType} onValueChange={(value) => setVoucherType((value ?? "ManualAdjustment") as ManualVoucherType)} options={manualTypes.map((item) => ({ value: item.value, label: item.label, description: item.description }))} placeholder="Select adjustment purpose" /><p className="text-[11px] text-muted-foreground">{manualTypes.find((item) => item.value === voucherType)?.description}</p></Field><Field label="Voucher date"><Input type="date" value={voucherDate} onChange={(event) => setVoucherDate(event.target.value)} /></Field><Field label="External reference"><Input value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} placeholder="Optional document ref" /></Field><Field label="Business reason *"><Textarea id="voucher-memo" className="min-h-9" value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="Explain the purpose and supporting document" /></Field></div><div className="overflow-x-auto rounded-xl border"><datalist id="journal-account-codes">{standardAccounts.map((account) => <option key={account.code} value={account.code}>{account.name}</option>)}</datalist><div className="min-w-[950px]"><div className="grid grid-cols-[45px_130px_220px_1fr_140px_140px_45px] gap-2 border-b bg-muted/50 p-2 text-xs font-bold"><span>#</span><span>Account code</span><span>Account name</span><span>Description</span><span className="text-end">Debit</span><span className="text-end">Credit</span><span /></div>{lines.map((line, index) => <JournalLine key={line.key} id={`journal-line-${index}`} line={line} index={index} onChange={(next) => setLines((current) => current.map((item) => item.key === line.key ? next : item))} onRemove={() => setLines((current) => current.length > 2 ? current.filter((item) => item.key !== line.key) : current)} />)}<div className="grid grid-cols-[1fr_140px_140px_45px] gap-2 bg-muted/30 p-3 text-sm font-bold"><span className="text-end">Totals</span><span className="text-end tabular-nums">{formatMoney(totals.debit)}</span><span className="text-end tabular-nums">{formatMoney(totals.credit)}</span><span /></div></div></div><DialogFooter className="sm:justify-between"><div className="flex flex-wrap items-center gap-2"><Button variant="outline" onClick={() => setLines((current) => [...current, newLine()])}><Plus />Add account line</Button><Badge variant={balanced ? "default" : "destructive"}><Scale className="size-3" />{balanced ? "Balanced" : totals.debit <= 0 && totals.credit <= 0 ? "Amounts required" : `Difference ${formatMoney(difference)}`}</Badge></div><div className="flex gap-2"><Button variant="outline" disabled={create.isPending} onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={create.isPending || !balanced} onClick={submit}>{create.isPending ? <LoaderCircle className="animate-spin" /> : <Save />}{create.isPending ? "Posting…" : "Post adjustment"}</Button></div></DialogFooter></DialogContent></Dialog>;
}

function JournalLine({ id, line, index, onChange, onRemove }: { id: string; line: DraftLine; index: number; onChange: (line: DraftLine) => void; onRemove: () => void }) { const field = <K extends keyof DraftLine>(key: K, value: DraftLine[K]) => onChange({ ...line, [key]: value }); return <div id={id} className="grid scroll-mt-24 grid-cols-[45px_130px_220px_1fr_140px_140px_45px] gap-2 border-b p-2 last:border-b-0"><span className="self-center text-center text-sm font-semibold text-muted-foreground">{index + 1}</span><Input list="journal-account-codes" value={line.accountCode} onChange={(event) => { const accountCode = event.target.value; const standard = standardAccounts.find((account) => account.code === accountCode.trim()); onChange({ ...line, accountCode, accountName: standard?.name ?? line.accountName }); }} placeholder="1000" /><Input value={line.accountName} onChange={(event) => field("accountName", event.target.value)} placeholder="Cash on Hand" /><Input value={line.description ?? ""} onChange={(event) => field("description", event.target.value)} placeholder="Line note" /><Input className="text-end" type="number" min={0} step="0.01" value={line.debit || ""} onChange={(event) => { const debit = Number(event.target.value); onChange({ ...line, debit, credit: debit > 0 ? 0 : line.credit }); }} /><Input className="text-end" type="number" min={0} step="0.01" value={line.credit || ""} onChange={(event) => { const credit = Number(event.target.value); onChange({ ...line, credit, debit: credit > 0 ? 0 : line.debit }); }} /><Button size="icon" variant="ghost" onClick={onRemove}><Trash2 className="size-4 text-destructive" /></Button></div>; }
function Metric({ icon, label, value, tone }: { icon: ReactNode; label: string; value: ReactNode; tone?: "positive" | "warning" }) { return <Card className="shadow-none"><CardContent className="flex items-center gap-3 p-4"><span className={`grid size-10 place-items-center rounded-xl [&_svg]:size-5 ${tone === "positive" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : tone === "warning" ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" : "bg-primary/10 text-primary"}`}>{icon}</span><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-bold tabular-nums">{value}</p></div></CardContent></Card>; }
function templateLine(code: string, description: string): DraftLine { const account = standardAccounts.find((item) => item.code === code); return { key: createUuid(), accountCode: code, accountName: account?.name ?? "", description, debit: 0, credit: 0 }; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
function date(value: string | null | undefined) {
    if (!value) return "Date unavailable";
    const parsed = new Date(`${value.slice(0, 10)}T00:00:00Z`);
    return Number.isNaN(parsed.getTime())
        ? "Date unavailable"
        : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" }).format(parsed);
}
function dateTime(value: string | null | undefined) {
    if (!value) return "Not recorded";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
        ? "Not recorded"
        : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}
function invalid(id: string, text: string) { toast.error(text); document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" }); document.getElementById(id)?.querySelector<HTMLElement>("input,textarea")?.focus(); }
function voucherLabel(type: JournalVoucherType) { return voucherTypes.find((item) => item.value === type)?.label ?? type; }
function sourceHref(voucher: JournalVoucher) { if (!voucher.sourceType || !voucher.sourceId) return null; if (voucher.sourceType === "OnlineOrder") return `/orders/${voucher.sourceId}`; if (voucher.sourceType === "OnlinePayment") return voucher.sourceNumber ? `/orders?search=${encodeURIComponent(voucher.sourceNumber)}` : "/orders"; if (voucher.sourceType === "Purchase" || voucher.sourceType === "PurchasePayment") return "/operations/purchases"; if (voucher.sourceType === "ManualSale" || voucher.sourceType === "SalePayment") return "/operations/sales"; if (voucher.sourceType === "Expense") return "/operations/expenses"; if (voucher.sourceType === "Payroll" || voucher.sourceType === "PayrollPayment") return "/operations/staff"; return null; }
