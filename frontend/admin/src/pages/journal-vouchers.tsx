import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, LoaderCircle, Plus, Save, Scale, Trash2 } from "lucide-react";
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
import { useCompany } from "@/features/company/company-context";
import { operationsService } from "@/features/operations/operations-service";
import type { CreateJournalVoucher } from "@/features/operations/operations-types";

type DraftLine = CreateJournalVoucher["lines"][number] & { key: string };

const newLine = (): DraftLine => ({ key: crypto.randomUUID(), accountCode: "", accountName: "", description: null, debit: 0, credit: 0 });

export default function JournalVouchersPage() {
    const queryClient = useQueryClient();
    const { formatMoney } = useCompany();
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
    const totals = useMemo(() => ({
        debit: lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0),
        credit: lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0),
    }), [lines]);
    const difference = Math.abs(totals.debit - totals.credit);
    const balanced = totals.debit > 0 && difference < 0.01;

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
                <div className="grid gap-4 md:grid-cols-[180px_220px_1fr]">
                    <Field label="Voucher date"><Input type="date" value={voucherDate} onChange={(event) => setVoucherDate(event.target.value)} /></Field>
                    <Field label="Voucher number (optional)"><Input value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} placeholder="Automatic if blank" /></Field>
                    <Field label="Memo"><Textarea id="voucher-memo" className="min-h-9" value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="Purpose of this accounting entry" /></Field>
                </div>
                <div className="overflow-x-auto rounded-xl border">
                    <div className="min-w-[950px]">
                        <div className="grid grid-cols-[45px_130px_220px_1fr_140px_140px_45px] gap-2 border-b bg-muted/50 p-2 text-xs font-bold"><span>#</span><span>Account code</span><span>Account name</span><span>Description</span><span className="text-end">Debit</span><span className="text-end">Credit</span><span /></div>
                        {lines.map((line, index) => <JournalLine key={line.key} id={`journal-line-${index}`} line={line} index={index} onChange={(next) => setLines((current) => current.map((item) => item.key === line.key ? next : item))} onRemove={() => setLines((current) => current.filter((item) => item.key !== line.key))} />)}
                        <div className="grid grid-cols-[1fr_140px_140px_45px] gap-2 bg-muted/30 p-3 text-sm font-bold"><span className="text-end">Totals</span><span className="text-end tabular-nums">{formatMoney(totals.debit)}</span><span className="text-end tabular-nums">{formatMoney(totals.credit)}</span><span /></div>
                    </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2"><Button variant="outline" onClick={() => setLines((current) => [...current, newLine()])}><Plus />Add account line</Button><Badge variant={balanced ? "default" : "destructive"}><Scale className="size-3" />{balanced ? "Balanced" : `Difference ${formatMoney(difference)}`}</Badge></div>
                    <Button disabled={create.isPending || !balanced} onClick={submit}>{create.isPending ? <LoaderCircle className="animate-spin" /> : <Save />}{create.isPending ? "Posting…" : "Post voucher"}</Button>
                </div>
            </CardContent>
        </Card>

        <Card className="overflow-hidden shadow-none"><CardHeader><CardTitle>Posted vouchers</CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><Table className="min-w-[800px]"><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Voucher</TableHead><TableHead>Memo</TableHead><TableHead>Lines</TableHead><TableHead className="text-end">Debit</TableHead><TableHead className="text-end">Credit</TableHead></TableRow></TableHeader><TableBody>{query.isLoading ? <TableRow><TableCell colSpan={6} className="h-32 text-center"><LoaderCircle className="mx-auto size-5 animate-spin" /></TableCell></TableRow> : query.data?.items.length ? query.data.items.map((voucher) => <TableRow key={voucher.id}><TableCell>{date(voucher.voucherDate)}</TableCell><TableCell className="font-semibold">{voucher.voucherNumber}</TableCell><TableCell className="max-w-md"><details><summary className="cursor-pointer font-medium">{voucher.memo}</summary><div className="mt-2 space-y-1 text-xs text-muted-foreground">{voucher.lines.map((line) => <p key={line.id}>{line.accountCode} · {line.accountName}: {line.debit > 0 ? `Dr ${formatMoney(line.debit)}` : `Cr ${formatMoney(line.credit)}`}</p>)}</div></details></TableCell><TableCell>{voucher.lines.length}</TableCell><TableCell className="text-end tabular-nums">{formatMoney(voucher.totalDebit, voucher.currencyCode)}</TableCell><TableCell className="text-end tabular-nums">{formatMoney(voucher.totalCredit, voucher.currencyCode)}</TableCell></TableRow>) : <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">No journal vouchers have been posted.</TableCell></TableRow>}</TableBody></Table></div></CardContent><ListPagination page={page} pageSize={pageSize} totalCount={query.data?.totalCount ?? 0} totalPages={query.data?.totalPages} disabled={query.isLoading} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} /></Card>
    </div>;
}

function JournalLine({ id, line, index, onChange, onRemove }: { id: string; line: DraftLine; index: number; onChange: (line: DraftLine) => void; onRemove: () => void }) {
    const field = <K extends keyof DraftLine>(key: K, value: DraftLine[K]) => onChange({ ...line, [key]: value });
    return <div id={id} className="grid scroll-mt-24 grid-cols-[45px_130px_220px_1fr_140px_140px_45px] gap-2 border-b p-2 last:border-b-0"><span className="self-center text-center text-sm font-semibold text-muted-foreground">{index + 1}</span><Input value={line.accountCode} onChange={(event) => field("accountCode", event.target.value)} placeholder="1000" /><Input value={line.accountName} onChange={(event) => field("accountName", event.target.value)} placeholder="Cash" /><Input value={line.description ?? ""} onChange={(event) => field("description", event.target.value)} placeholder="Line note" /><Input className="text-end" type="number" min={0} step="0.01" value={line.debit || ""} onChange={(event) => { const debit = Number(event.target.value); onChange({ ...line, debit, credit: debit > 0 ? 0 : line.credit }); }} /><Input className="text-end" type="number" min={0} step="0.01" value={line.credit || ""} onChange={(event) => { const credit = Number(event.target.value); onChange({ ...line, credit, debit: credit > 0 ? 0 : line.debit }); }} /><Button size="icon" variant="ghost" onClick={onRemove}><Trash2 className="size-4 text-destructive" /></Button></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
function date(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
function invalid(id: string, text: string) { toast.error(text); document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" }); document.getElementById(id)?.querySelector<HTMLElement>("input,textarea")?.focus(); }
function message(error: unknown) { return (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? (error as Error).message ?? "The voucher could not be posted."; }
