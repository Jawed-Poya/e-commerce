import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Info, LoaderCircle, Plus, Save, Scale, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ListPagination } from "@/components/list-pagination";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAdminAuth } from "@/features/auth/auth-context";
import { hasPermission, Permissions } from "@/features/auth/permissions";
import { useCompany } from "@/features/company/company-context";
import { operationsService } from "@/features/operations/operations-service";
import type { CreateJournalVoucher } from "@/features/operations/operations-types";

type DraftLine = CreateJournalVoucher["lines"][number] & { key: string };

const newLine = (): DraftLine => ({ key: crypto.randomUUID(), accountCode: "", accountName: "", description: null, debit: 0, credit: 0 });

const standardAccounts = [
    { code: "1000", name: "Cash on Hand" },
    { code: "1010", name: "Bank Account" },
    { code: "1100", name: "Accounts Receivable" },
    { code: "1200", name: "Inventory" },
    { code: "1300", name: "Prepaid Expenses" },
    { code: "1500", name: "Fixed Assets" },
    { code: "2000", name: "Accounts Payable" },
    { code: "2100", name: "Accrued Expenses" },
    { code: "2200", name: "Payroll Payable" },
    { code: "3000", name: "Owner Capital" },
    { code: "3100", name: "Owner Drawings" },
    { code: "4000", name: "Sales Revenue" },
    { code: "4100", name: "Other Income" },
    { code: "5000", name: "Cost of Goods Sold" },
    { code: "6000", name: "Operating Expense" },
    { code: "6100", name: "Salary Expense" },
    { code: "6200", name: "Rent Expense" },
    { code: "6300", name: "Utilities Expense" },
] as const;

const voucherTemplates = [
    { title: "Owner capital received", memo: "Owner capital introduced into cash", debit: "1000", credit: "3000" },
    { title: "Cash deposited to bank", memo: "Transfer from cash on hand to bank", debit: "1010", credit: "1000" },
    { title: "Expense accrued", memo: "Operating expense accrued for later payment", debit: "6000", credit: "2100" },
] as const;

export default function JournalVouchersPage() {
    const queryClient = useQueryClient();
    const { formatMoney } = useCompany();
    const { user } = useAdminAuth();
    const canPost = hasPermission(user, Permissions.ExpensesManage);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [voucherDate, setVoucherDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [referenceNumber, setReferenceNumber] = useState("");
    const [memo, setMemo] = useState("");
    const [lines, setLines] = useState<DraftLine[]>([newLine(), newLine()]);

    const query = useQuery({
        queryKey: ["journal-vouchers", page, pageSize],
        queryFn: async () => (await operationsService.journalVouchers(page, pageSize)).data,
    });
    const accountBalances = useQuery({
        queryKey: ["journal-vouchers", "accounts"],
        queryFn: async () => (await operationsService.journalAccountBalances()).data,
    });
    const totals = useMemo(() => ({
        debit: lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0),
        credit: lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0),
    }), [lines]);
    const difference = Math.abs(totals.debit - totals.credit);
    const balanced = totals.debit > 0 && difference < 0.01;
    const balanceMessage = !canPost
        ? "Your account has read-only access to journal vouchers."
        : totals.debit <= 0 && totals.credit <= 0
        ? "Enter at least one debit and one credit amount."
        : balanced
            ? "Balanced and ready for validation."
            : `Debit and credit differ by ${formatMoney(difference)}.`;

    const applyTemplate = (template: typeof voucherTemplates[number]) => {
        setMemo(template.memo);
        setLines([
            templateLine(template.debit, "Enter the debit amount"),
            templateLine(template.credit, "Enter the matching credit amount"),
        ]);
    };

    const create = useMutation({
        mutationFn: (body: CreateJournalVoucher) => operationsService.createJournalVoucher(body),
        onSuccess: async (response) => {
            await queryClient.invalidateQueries({ queryKey: ["journal-vouchers"] });
            toast.success(`Voucher ${response.data.voucherNumber} posted.`);
            setMemo(""); setReferenceNumber(""); setLines([newLine(), newLine()]);
        },
        onError: (error) => toast.error(message(error)),
    });

    const submit = () => {
        if (!canPost) return toast.error("You do not have permission to post journal vouchers.");
        if (!memo.trim()) return invalid("voucher-memo", "A voucher memo is required.");
        const invalidIndex = lines.findIndex((line) => !line.accountCode.trim() || !line.accountName.trim() || line.debit < 0 || line.credit < 0 || (line.debit > 0) === (line.credit > 0));
        if (invalidIndex >= 0) return invalid(`journal-line-${invalidIndex}`, `Line ${invalidIndex + 1} needs an account and either one debit or one credit amount.`);
        if (!balanced) return toast.error(`Voucher is not balanced. Difference: ${formatMoney(difference)}.`);
        create.mutate({
            voucherDate,
            memo: memo.trim(),
            referenceNumber: referenceNumber.trim() || null,
            lines: lines.map(({ key: _, ...line }) => ({ ...line, description: line.description?.trim() || null })),
        });
    };

    return <div className="space-y-6">
        <PageHeader title="Journal vouchers" description="Post balanced double-entry vouchers from a fast spreadsheet and retain an auditable account history." />
        <Card className="shadow-none">
            <CardHeader className="border-b"><CardTitle className="flex items-center gap-2"><BookOpen className="size-5 text-primary" />New journal voucher</CardTitle></CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6">
                <div className="rounded-xl border border-primary/20 bg-primary/[0.035] p-4 text-sm">
                    <div className="flex items-start gap-3"><Info className="mt-0.5 size-5 shrink-0 text-primary" /><div><p className="font-semibold">Use vouchers for accounting entries not already recorded by another module.</p><p className="mt-1 text-muted-foreground">Good uses include opening balances, owner capital, cash-to-bank transfers, accruals, and documented corrections. Record normal purchases, sales, expenses, payroll, and their payments in their own screens so they are not counted twice.</p></div></div>
                    <div className="mt-3 flex flex-wrap gap-2">{voucherTemplates.map((template) => <Button key={template.title} type="button" size="sm" variant="outline" onClick={() => applyTemplate(template)}>{template.title}</Button>)}</div>
                </div>
                <div className="grid gap-4 md:grid-cols-[180px_220px_1fr]">
                    <Field label="Voucher date"><Input type="date" value={voucherDate} onChange={(event) => setVoucherDate(event.target.value)} /></Field>
                    <Field label="Voucher number (optional)"><Input value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} placeholder="Automatic if blank" /></Field>
                    <Field label="Memo"><Textarea id="voucher-memo" className="min-h-9" value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="Purpose of this accounting entry" /></Field>
                </div>
                <div className="overflow-x-auto rounded-xl border">
                    <datalist id="journal-account-codes">{standardAccounts.map((account) => <option key={account.code} value={account.code}>{account.name}</option>)}</datalist>
                    <div className="min-w-[950px]">
                        <div className="grid grid-cols-[45px_130px_220px_1fr_140px_140px_45px] gap-2 border-b bg-muted/50 p-2 text-xs font-bold"><span>#</span><span>Account code</span><span>Account name</span><span>Description</span><span className="text-end">Debit</span><span className="text-end">Credit</span><span /></div>
                        {lines.map((line, index) => <JournalLine key={line.key} id={`journal-line-${index}`} line={line} index={index} onChange={(next) => setLines((current) => current.map((item) => item.key === line.key ? next : item))} onRemove={() => setLines((current) => current.filter((item) => item.key !== line.key))} />)}
                        <div className="grid grid-cols-[1fr_140px_140px_45px] gap-2 bg-muted/30 p-3 text-sm font-bold"><span className="text-end">Totals</span><span className="text-end tabular-nums">{formatMoney(totals.debit)}</span><span className="text-end tabular-nums">{formatMoney(totals.credit)}</span><span /></div>
                    </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div><div className="flex flex-wrap items-center gap-2"><Button variant="outline" onClick={() => setLines((current) => [...current, newLine()])}><Plus />Add account line</Button><Badge variant={balanced ? "default" : "destructive"}><Scale className="size-3" />{balanced ? "Balanced" : totals.debit <= 0 && totals.credit <= 0 ? "Amounts required" : `Difference ${formatMoney(difference)}`}</Badge></div><p className="mt-2 text-xs text-muted-foreground">{balanceMessage}</p></div>
                    <Button disabled={create.isPending || !canPost} onClick={submit}>{create.isPending ? <LoaderCircle className="animate-spin" /> : <Save />}{create.isPending ? "Posting…" : canPost ? "Post voucher" : "Read-only access"}</Button>
                </div>
            </CardContent>
        </Card>

        <Card className="overflow-hidden shadow-none"><CardHeader><CardTitle>Manual journal account balances</CardTitle><p className="text-sm text-muted-foreground">Debit and credit totals from posted manual vouchers. Operational sales, purchases, expenses, and payroll remain in their dedicated reports.</p></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><Table className="min-w-[760px]"><TableHeader><TableRow><TableHead>Account</TableHead><TableHead>Name</TableHead><TableHead>Entries</TableHead><TableHead className="text-end">Debits</TableHead><TableHead className="text-end">Credits</TableHead><TableHead className="text-end">Balance</TableHead></TableRow></TableHeader><TableBody>{accountBalances.isLoading ? <TableRow><TableCell colSpan={6} className="h-24 text-center"><LoaderCircle className="mx-auto size-5 animate-spin" /></TableCell></TableRow> : accountBalances.data?.length ? accountBalances.data.map((account) => <TableRow key={account.accountCode}><TableCell className="font-mono font-semibold">{account.accountCode}</TableCell><TableCell>{account.accountName}</TableCell><TableCell>{account.entryCount}</TableCell><TableCell className="text-end">{formatMoney(account.totalDebit)}</TableCell><TableCell className="text-end">{formatMoney(account.totalCredit)}</TableCell><TableCell className="text-end font-semibold">{account.balance > 0 ? `Dr ${formatMoney(account.balance)}` : account.balance < 0 ? `Cr ${formatMoney(Math.abs(account.balance))}` : formatMoney(0)}</TableCell></TableRow>) : <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Post a balanced voucher to start the manual journal ledger.</TableCell></TableRow>}</TableBody></Table></div></CardContent></Card>

        <Card className="overflow-hidden shadow-none"><CardHeader><CardTitle>Posted vouchers</CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><Table className="min-w-[800px]"><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Voucher</TableHead><TableHead>Memo</TableHead><TableHead>Lines</TableHead><TableHead className="text-end">Debit</TableHead><TableHead className="text-end">Credit</TableHead></TableRow></TableHeader><TableBody>{query.isLoading ? <TableRow><TableCell colSpan={6} className="h-32 text-center"><LoaderCircle className="mx-auto size-5 animate-spin" /></TableCell></TableRow> : query.data?.items.length ? query.data.items.map((voucher) => <TableRow key={voucher.id}><TableCell>{date(voucher.voucherDate)}</TableCell><TableCell className="font-semibold">{voucher.voucherNumber}</TableCell><TableCell className="max-w-md"><details><summary className="cursor-pointer font-medium">{voucher.memo}</summary><div className="mt-2 space-y-1 text-xs text-muted-foreground">{voucher.lines.map((line) => <p key={line.id}>{line.accountCode} · {line.accountName}: {line.debit > 0 ? `Dr ${formatMoney(line.debit)}` : `Cr ${formatMoney(line.credit)}`}</p>)}</div></details></TableCell><TableCell>{voucher.lines.length}</TableCell><TableCell className="text-end tabular-nums">{formatMoney(voucher.totalDebit, voucher.currencyCode)}</TableCell><TableCell className="text-end tabular-nums">{formatMoney(voucher.totalCredit, voucher.currencyCode)}</TableCell></TableRow>) : <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">No journal vouchers have been posted.</TableCell></TableRow>}</TableBody></Table></div></CardContent><ListPagination page={page} pageSize={pageSize} totalCount={query.data?.totalCount ?? 0} totalPages={query.data?.totalPages} disabled={query.isLoading} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} /></Card>
    </div>;
}

function JournalLine({ id, line, index, onChange, onRemove }: { id: string; line: DraftLine; index: number; onChange: (line: DraftLine) => void; onRemove: () => void }) {
    const field = <K extends keyof DraftLine>(key: K, value: DraftLine[K]) => onChange({ ...line, [key]: value });
    return <div id={id} className="grid scroll-mt-24 grid-cols-[45px_130px_220px_1fr_140px_140px_45px] gap-2 border-b p-2 last:border-b-0"><span className="self-center text-center text-sm font-semibold text-muted-foreground">{index + 1}</span><Input list="journal-account-codes" value={line.accountCode} onChange={(event) => { const accountCode = event.target.value; const standard = standardAccounts.find((account) => account.code === accountCode.trim()); onChange({ ...line, accountCode, accountName: standard?.name ?? line.accountName }); }} placeholder="1000" /><Input value={line.accountName} onChange={(event) => field("accountName", event.target.value)} placeholder="Cash on Hand" /><Input value={line.description ?? ""} onChange={(event) => field("description", event.target.value)} placeholder="Line note" /><Input className="text-end" type="number" min={0} step="0.01" value={line.debit || ""} onChange={(event) => { const debit = Number(event.target.value); onChange({ ...line, debit, credit: debit > 0 ? 0 : line.credit }); }} /><Input className="text-end" type="number" min={0} step="0.01" value={line.credit || ""} onChange={(event) => { const credit = Number(event.target.value); onChange({ ...line, credit, debit: credit > 0 ? 0 : line.debit }); }} /><Button size="icon" variant="ghost" onClick={onRemove}><Trash2 className="size-4 text-destructive" /></Button></div>;
}

function templateLine(code: string, description: string): DraftLine {
    const account = standardAccounts.find((item) => item.code === code);
    return { key: crypto.randomUUID(), accountCode: code, accountName: account?.name ?? "", description, debit: 0, credit: 0 };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
function date(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
function invalid(id: string, text: string) { toast.error(text); document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" }); document.getElementById(id)?.querySelector<HTMLElement>("input,textarea")?.focus(); }
function message(error: unknown) { return (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? (error as Error).message ?? "The voucher could not be posted."; }
