import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileText, FolderPlus, LoaderCircle, Pencil, Plus, ReceiptText, Save, Tags, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ListPagination } from "@/components/list-pagination";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAdminAuth } from "@/features/auth/auth-context";
import { hasPermission, Permissions } from "@/features/auth/permissions";
import { operationKeys, useOperationQuery } from "@/features/operations/operations-hooks";
import { operationsService } from "@/features/operations/operations-service";
import { companyService } from "@/features/company/company-service";
import type { ExpenseCategory } from "@/features/operations/operations-types";
import { useCompany } from "@/features/company/company-context";

const today = () => new Date().toISOString().slice(0, 10);
type ExpenseDraft = { expenseDate: string; categoryId: string; amount: number; vendor: string; paymentMethod: string; referenceNumber: string; description: string };
const emptyExpense = (): ExpenseDraft => ({ expenseDate: today(), categoryId: "", amount: 0, vendor: "", paymentMethod: "Cash", referenceNumber: "", description: "" });

export default function ExpensesPage() {
    const queryClient = useQueryClient();
    const { user } = useAdminAuth();
    const { formatMoney } = useCompany();
    const canManage = hasPermission(user, Permissions.ExpensesManage);
    const [expensePage, setExpensePage] = useState(1);
    const [expensePageSize, setExpensePageSize] = useState(20);
    const [categoryPage, setCategoryPage] = useState(1);
    const [categoryPageSize, setCategoryPageSize] = useState(20);
    const { data: expensePageData, isLoading } = useOperationQuery(
        operationKeys.expensePage(expensePage, expensePageSize),
        () => operationsService.expenses(expensePage, expensePageSize),
    );
    const expenses = expensePageData?.items;
    const { data: categories, isLoading: categoriesLoading } = useOperationQuery(operationKeys.expenseCategories, operationsService.expenseCategories);
    const categoryItems = categories?.slice((categoryPage - 1) * categoryPageSize, categoryPage * categoryPageSize);
    const [tab, setTab] = useState<"expenses" | "categories">("expenses");
    const [expenseOpen, setExpenseOpen] = useState(false);
    const [categoryOpen, setCategoryOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [exportingPdf, setExportingPdf] = useState(false);
    const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
    const [expenseRows, setExpenseRows] = useState<ExpenseDraft[]>([emptyExpense()]);
    const [category, setCategory] = useState({ name: "", description: "", isActive: true });

    const openCategory = (item?: ExpenseCategory) => { setEditingCategory(item ?? null); setCategory(item ? { name: item.name, description: item.description ?? "", isActive: item.isActive } : { name: "", description: "", isActive: true }); setCategoryOpen(true); };
    const saveExpense = async () => {
        const rows = expenseRows.filter((row) => row.categoryId || row.amount > 0 || row.description.trim());
        const invalid = rows.findIndex((row) => !row.categoryId || row.amount <= 0 || !row.description.trim());
        if (invalid >= 0) return toast.error(`Expense row ${invalid + 1}: category, amount, and description are required.`);
        if (!rows.length) return toast.error("Add at least one expense row.");
        setSaving(true);
        try {
            await Promise.all(rows.map((expense) => operationsService.createExpense({ ...expense, categoryId: Number(expense.categoryId), vendor: nullable(expense.vendor), referenceNumber: nullable(expense.referenceNumber) })));
            await Promise.all([queryClient.invalidateQueries({ queryKey: operationKeys.expenses }), queryClient.invalidateQueries({ queryKey: operationKeys.summary })]);
            toast.success(`${rows.length} expense row(s) recorded.`); setExpenseOpen(false); setExpenseRows([emptyExpense()]);
        } catch (error) { toast.error(message(error)); } finally { setSaving(false); }
    };
    const saveCategory = async () => {
        if (!category.name.trim()) return toast.error("Category name is required.");
        setSaving(true);
        try {
            await operationsService.saveExpenseCategory(editingCategory?.id ?? null, { name: category.name.trim(), description: nullable(category.description), isActive: category.isActive });
            await queryClient.invalidateQueries({ queryKey: operationKeys.expenseCategories });
            toast.success(editingCategory ? "Category updated." : "Category created in General Types."); setCategoryOpen(false);
        } catch (error) { toast.error(message(error)); } finally { setSaving(false); }
    };

    const exportPdf = async () => {
        setExportingPdf(true);
        try {
            await companyService.exportOperationalPdf("expenses");
        } catch (error) {
            toast.error(message(error));
        } finally {
            setExportingPdf(false);
        }
    };

    return <div className="space-y-6">
        <PageHeader title="Expenses" description="Expense categories are stored in the shared General Types table under the ExpenseCategory group." actions={<div className="flex flex-wrap gap-2"><Button variant="outline" disabled={exportingPdf} onClick={() => void exportPdf()}>{exportingPdf ? <LoaderCircle className="me-2 size-4 animate-spin" /> : <FileText className="me-2 size-4" />}Export PDF</Button>{canManage ? <><Button variant="outline" onClick={() => openCategory()}><FolderPlus className="me-2 size-4" />New category</Button><Button onClick={() => { setExpenseRows([emptyExpense(), emptyExpense(), emptyExpense()]); setExpenseOpen(true); }}><ReceiptText className="me-2 size-4" />Expense sheet</Button></> : null}</div>} />
        <div className="inline-flex rounded-lg border bg-muted/40 p-1"><Button size="sm" variant={tab === "expenses" ? "default" : "ghost"} onClick={() => setTab("expenses")}><ReceiptText className="me-2 size-4" />Expenses</Button><Button size="sm" variant={tab === "categories" ? "default" : "ghost"} onClick={() => setTab("categories")}><Tags className="me-2 size-4" />Categories</Button></div>
        {tab === "expenses" ? <Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Category</TableHead><TableHead>Description</TableHead><TableHead>Vendor</TableHead><TableHead>Method</TableHead><TableHead>Reference</TableHead><TableHead className="text-end">Amount</TableHead></TableRow></TableHeader><TableBody>{isLoading ? <Loading colSpan={7} /> : expenses?.length ? expenses.map((item) => <TableRow key={item.id}><TableCell>{date(item.expenseDate)}</TableCell><TableCell><Badge variant="outline">{item.categoryName}</Badge></TableCell><TableCell className="max-w-md"><p className="truncate">{item.description}</p></TableCell><TableCell>{item.vendor ?? "—"}</TableCell><TableCell>{item.paymentMethod}</TableCell><TableCell>{item.referenceNumber ?? "—"}</TableCell><TableCell className="text-end font-semibold">{formatMoney(item.amount)}</TableCell></TableRow>) : <Empty colSpan={7} text="No expenses have been recorded." />}</TableBody></Table></CardContent><ListPagination page={expensePage} pageSize={expensePageSize} totalCount={expensePageData?.totalCount ?? 0} totalPages={expensePageData?.totalPages} disabled={isLoading} onPageChange={setExpensePage} onPageSizeChange={(size) => { setExpensePageSize(size); setExpensePage(1); }} /></Card> : <Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Category</TableHead><TableHead>Group</TableHead><TableHead>Description</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader><TableBody>{categoriesLoading ? <Loading colSpan={5} /> : categoryItems?.length ? categoryItems.map((item) => <TableRow key={item.id}><TableCell className="font-medium">{item.name}</TableCell><TableCell><Badge variant="secondary">ExpenseCategory</Badge></TableCell><TableCell>{item.description ?? "—"}</TableCell><TableCell><Badge variant={item.isActive ? "default" : "outline"}>{item.isActive ? "Active" : "Inactive"}</Badge></TableCell><TableCell>{canManage ? <Button size="icon" variant="ghost" onClick={() => openCategory(item)}><Pencil className="size-4" /></Button> : null}</TableCell></TableRow>) : <Empty colSpan={5} text="No expense categories exist." />}</TableBody></Table></CardContent><ListPagination page={categoryPage} pageSize={categoryPageSize} totalCount={categories?.length ?? 0} disabled={categoriesLoading} onPageChange={setCategoryPage} onPageSizeChange={(size) => { setCategoryPageSize(size); setCategoryPage(1); }} /></Card>}
        <Sheet open={expenseOpen} onOpenChange={setExpenseOpen}><SheetContent side="right" className="!w-screen !max-w-none border-0"><SheetHeader className="border-b"><SheetTitle>Expense entry sheet</SheetTitle><SheetDescription>Enter several categorized costs and save them together. Empty rows are ignored.</SheetDescription></SheetHeader><div className="min-h-0 flex-1 overflow-auto p-4"><div className="min-w-[1250px] overflow-hidden rounded-xl border"><div className="grid grid-cols-[45px_140px_190px_130px_180px_160px_160px_1fr_45px] gap-2 border-b bg-muted/50 p-2 text-xs font-bold"><span>#</span><span>Date</span><span>Category *</span><span>Amount *</span><span>Paid to</span><span>Method</span><span>Reference</span><span>Description *</span><span /></div>{expenseRows.map((row, index) => <ExpenseSheetRow key={index} row={row} index={index} categories={categories?.filter((item) => item.isActive) ?? []} onChange={(next) => setExpenseRows((current) => current.map((item, itemIndex) => itemIndex === index ? next : item))} onRemove={() => setExpenseRows((current) => current.filter((_, itemIndex) => itemIndex !== index))} />)}</div></div><SheetFooter className="flex-row justify-between border-t"><Button variant="outline" onClick={() => setExpenseRows((current) => [...current, emptyExpense()])}><Plus />Add row</Button><div className="flex gap-2"><Button variant="outline" onClick={() => setExpenseOpen(false)}>Cancel</Button><Button onClick={() => void saveExpense()} disabled={saving}>{saving ? <LoaderCircle className="animate-spin" /> : <Save />}Save sheet</Button></div></SheetFooter></SheetContent></Sheet>
        <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}><DialogContent><DialogHeader><DialogTitle>{editingCategory ? "Edit expense category" : "New expense category"}</DialogTitle><DialogDescription>This record is saved in General Types with group ExpenseCategory and remains manageable here.</DialogDescription></DialogHeader><div className="space-y-4"><Field label="Category name *"><Input value={category.name} onChange={(event) => setCategory((x) => ({ ...x, name: event.target.value }))} /></Field><Field label="Description"><Textarea value={category.description} onChange={(event) => setCategory((x) => ({ ...x, description: event.target.value }))} /></Field><label className="flex items-center gap-3"><Checkbox checked={category.isActive} onCheckedChange={(checked) => setCategory((x) => ({ ...x, isActive: checked === true }))} />Active category</label></div><DialogFooter><Button variant="outline" onClick={() => setCategoryOpen(false)}>Cancel</Button><Button onClick={() => void saveCategory()} disabled={saving}>{editingCategory ? <Save className="me-2 size-4" /> : <Plus className="me-2 size-4" />}Save category</Button></DialogFooter></DialogContent></Dialog>
    </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
function ExpenseSheetRow({ row, index, categories, onChange, onRemove }: { row: ExpenseDraft; index: number; categories: ExpenseCategory[]; onChange: (row: ExpenseDraft) => void; onRemove: () => void }) { const field = <K extends keyof ExpenseDraft>(key: K, value: ExpenseDraft[K]) => onChange({ ...row, [key]: value }); return <div className="grid grid-cols-[45px_140px_190px_130px_180px_160px_160px_1fr_45px] gap-2 border-b p-2 last:border-b-0"><span className="self-center text-center font-semibold text-muted-foreground">{index + 1}</span><Input type="date" value={row.expenseDate} onChange={(event) => field("expenseDate", event.target.value)} /><select className="border-input h-9 rounded-md border bg-background px-2 text-sm" value={row.categoryId} onChange={(event) => field("categoryId", event.target.value)}><option value="">Select category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><Input type="number" min={0.01} step="0.01" value={row.amount} onChange={(event) => field("amount", Number(event.target.value))} /><Input value={row.vendor} onChange={(event) => field("vendor", event.target.value)} /><select className="border-input h-9 rounded-md border bg-background px-2 text-sm" value={row.paymentMethod} onChange={(event) => field("paymentMethod", event.target.value)}>{["Cash", "Card", "Bank transfer", "Mobile money", "Other"].map((value) => <option key={value}>{value}</option>)}</select><Input value={row.referenceNumber} onChange={(event) => field("referenceNumber", event.target.value)} /><Input value={row.description} onChange={(event) => field("description", event.target.value)} /><Button size="icon" variant="ghost" onClick={onRemove}><Trash2 className="size-4 text-destructive" /></Button></div>; }
function Loading({ colSpan }: { colSpan: number }) { return <TableRow><TableCell colSpan={colSpan} className="h-32 text-center"><LoaderCircle className="mx-auto size-5 animate-spin" /></TableCell></TableRow>; }
function Empty({ colSpan, text }: { colSpan: number; text: string }) { return <TableRow><TableCell colSpan={colSpan} className="h-32 text-center text-muted-foreground">{text}</TableCell></TableRow>; }
function nullable(value: string) { const result = value.trim(); return result || null; }
function date(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
function message(error: unknown) { const responseMessage = (error as { response?: { data?: { message?: string } } }).response?.data?.message; if (typeof responseMessage === "string" && responseMessage.trim()) return responseMessage.trim(); if (error instanceof Error && error.message.trim()) return error.message.trim(); return "The operation failed."; }
