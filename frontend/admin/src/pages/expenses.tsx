import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FolderPlus, LoaderCircle, Pencil, Plus, ReceiptText, Save, Tags } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { SimpleCombobox } from "@/components/simple-combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAdminAuth } from "@/features/auth/auth-context";
import { hasPermission, Permissions } from "@/features/auth/permissions";
import { operationKeys, useOperationQuery } from "@/features/operations/operations-hooks";
import { operationsService } from "@/features/operations/operations-service";
import type { ExpenseCategory } from "@/features/operations/operations-types";

const today = () => new Date().toISOString().slice(0, 10);

export default function ExpensesPage() {
    const queryClient = useQueryClient();
    const { user } = useAdminAuth();
    const canManage = hasPermission(user, Permissions.ExpensesManage);
    const { data: expenses, isLoading } = useOperationQuery(operationKeys.expenses, operationsService.expenses);
    const { data: categories, isLoading: categoriesLoading } = useOperationQuery(operationKeys.expenseCategories, operationsService.expenseCategories);
    const [tab, setTab] = useState<"expenses" | "categories">("expenses");
    const [expenseOpen, setExpenseOpen] = useState(false);
    const [categoryOpen, setCategoryOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory | null>(null);
    const [expense, setExpense] = useState({ expenseDate: today(), amount: 0, vendor: "", paymentMethod: "Cash", referenceNumber: "", description: "" });
    const [category, setCategory] = useState({ name: "", description: "", isActive: true });

    const openCategory = (item?: ExpenseCategory) => { setEditingCategory(item ?? null); setCategory(item ? { name: item.name, description: item.description ?? "", isActive: item.isActive } : { name: "", description: "", isActive: true }); setCategoryOpen(true); };
    const saveExpense = async () => {
        if (!selectedCategory || expense.amount <= 0 || !expense.description.trim()) return toast.error("Category, amount, and description are required.");
        setSaving(true);
        try {
            await operationsService.createExpense({ ...expense, categoryId: selectedCategory.id, vendor: nullable(expense.vendor), referenceNumber: nullable(expense.referenceNumber) });
            await Promise.all([queryClient.invalidateQueries({ queryKey: operationKeys.expenses }), queryClient.invalidateQueries({ queryKey: operationKeys.summary })]);
            toast.success("Expense recorded."); setExpenseOpen(false); setSelectedCategory(null); setExpense({ expenseDate: today(), amount: 0, vendor: "", paymentMethod: "Cash", referenceNumber: "", description: "" });
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

    return <div className="space-y-6">
        <PageHeader title="Expenses" description="Expense categories are stored in the shared General Types table under the ExpenseCategory group." actions={canManage ? <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => openCategory()}><FolderPlus className="me-2 size-4" />New category</Button><Button onClick={() => setExpenseOpen(true)}><ReceiptText className="me-2 size-4" />New expense</Button></div> : undefined} />
        <div className="inline-flex rounded-lg border bg-muted/40 p-1"><Button size="sm" variant={tab === "expenses" ? "default" : "ghost"} onClick={() => setTab("expenses")}><ReceiptText className="me-2 size-4" />Expenses</Button><Button size="sm" variant={tab === "categories" ? "default" : "ghost"} onClick={() => setTab("categories")}><Tags className="me-2 size-4" />Categories</Button></div>
        {tab === "expenses" ? <Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Category</TableHead><TableHead>Description</TableHead><TableHead>Vendor</TableHead><TableHead>Method</TableHead><TableHead>Reference</TableHead><TableHead className="text-end">Amount</TableHead></TableRow></TableHeader><TableBody>{isLoading ? <Loading colSpan={7} /> : expenses?.length ? expenses.map((item) => <TableRow key={item.id}><TableCell>{date(item.expenseDate)}</TableCell><TableCell><Badge variant="outline">{item.categoryName}</Badge></TableCell><TableCell className="max-w-md"><p className="truncate">{item.description}</p></TableCell><TableCell>{item.vendor ?? "—"}</TableCell><TableCell>{item.paymentMethod}</TableCell><TableCell>{item.referenceNumber ?? "—"}</TableCell><TableCell className="text-end font-semibold">{money(item.amount)}</TableCell></TableRow>) : <Empty colSpan={7} text="No expenses have been recorded." />}</TableBody></Table></CardContent></Card> : <Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Category</TableHead><TableHead>Group</TableHead><TableHead>Description</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader><TableBody>{categoriesLoading ? <Loading colSpan={5} /> : categories?.length ? categories.map((item) => <TableRow key={item.id}><TableCell className="font-medium">{item.name}</TableCell><TableCell><Badge variant="secondary">ExpenseCategory</Badge></TableCell><TableCell>{item.description ?? "—"}</TableCell><TableCell><Badge variant={item.isActive ? "default" : "outline"}>{item.isActive ? "Active" : "Inactive"}</Badge></TableCell><TableCell>{canManage ? <Button size="icon" variant="ghost" onClick={() => openCategory(item)}><Pencil className="size-4" /></Button> : null}</TableCell></TableRow>) : <Empty colSpan={5} text="No expense categories exist." />}</TableBody></Table></CardContent></Card>}
        <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>Record expense</DialogTitle><DialogDescription>Add a categorized business cost to the operational ledger.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><Field label="Expense date"><Input type="date" value={expense.expenseDate} onChange={(event) => setExpense((x) => ({ ...x, expenseDate: event.target.value }))} /></Field><div className="space-y-2"><Label>Expense category *</Label><Combobox items={categories?.filter((item) => item.isActive) ?? []} value={selectedCategory} onValueChange={(value) => setSelectedCategory((value as ExpenseCategory | null) ?? null)} itemToStringLabel={(item) => item ? (item as ExpenseCategory).name : ""}><ComboboxInput className="w-full" placeholder="Search category…" showClear={Boolean(selectedCategory)} /><ComboboxContent><ComboboxList>{categories?.filter((item) => item.isActive).map((item) => <ComboboxItem key={item.id} value={item}>{item.name}</ComboboxItem>)}</ComboboxList><ComboboxEmpty>No expense category found.</ComboboxEmpty></ComboboxContent></Combobox></div><Field label="Amount *"><Input type="number" min={0.01} step="0.01" value={expense.amount} onChange={(event) => setExpense((x) => ({ ...x, amount: Number(event.target.value) }))} /></Field><Field label="Vendor / paid to"><Input value={expense.vendor} onChange={(event) => setExpense((x) => ({ ...x, vendor: event.target.value }))} /></Field><Field label="Payment method"><SimpleCombobox value={expense.paymentMethod} onValueChange={(value) => setExpense((x) => ({ ...x, paymentMethod: value ?? "Cash" }))} options={["Cash", "Card", "Bank transfer", "Mobile money", "Other"].map((value) => ({ value, label: value }))} placeholder="Select payment method" /></Field><Field label="Reference"><Input value={expense.referenceNumber} onChange={(event) => setExpense((x) => ({ ...x, referenceNumber: event.target.value }))} /></Field><div className="space-y-2 sm:col-span-2"><Label>Description *</Label><Textarea rows={4} value={expense.description} onChange={(event) => setExpense((x) => ({ ...x, description: event.target.value }))} /></div></div><DialogFooter><Button variant="outline" onClick={() => setExpenseOpen(false)}>Cancel</Button><Button onClick={() => void saveExpense()} disabled={saving}>{saving ? <LoaderCircle className="me-2 size-4 animate-spin" /> : <Save className="me-2 size-4" />}Save expense</Button></DialogFooter></DialogContent></Dialog>
        <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}><DialogContent><DialogHeader><DialogTitle>{editingCategory ? "Edit expense category" : "New expense category"}</DialogTitle><DialogDescription>This record is saved in General Types with group ExpenseCategory and remains manageable here.</DialogDescription></DialogHeader><div className="space-y-4"><Field label="Category name *"><Input value={category.name} onChange={(event) => setCategory((x) => ({ ...x, name: event.target.value }))} /></Field><Field label="Description"><Textarea value={category.description} onChange={(event) => setCategory((x) => ({ ...x, description: event.target.value }))} /></Field><label className="flex items-center gap-3"><Checkbox checked={category.isActive} onCheckedChange={(checked) => setCategory((x) => ({ ...x, isActive: checked === true }))} />Active category</label></div><DialogFooter><Button variant="outline" onClick={() => setCategoryOpen(false)}>Cancel</Button><Button onClick={() => void saveCategory()} disabled={saving}>{editingCategory ? <Save className="me-2 size-4" /> : <Plus className="me-2 size-4" />}Save category</Button></DialogFooter></DialogContent></Dialog>
    </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
function Loading({ colSpan }: { colSpan: number }) { return <TableRow><TableCell colSpan={colSpan} className="h-32 text-center"><LoaderCircle className="mx-auto size-5 animate-spin" /></TableCell></TableRow>; }
function Empty({ colSpan, text }: { colSpan: number; text: string }) { return <TableRow><TableCell colSpan={colSpan} className="h-32 text-center text-muted-foreground">{text}</TableCell></TableRow>; }
function nullable(value: string) { const result = value.trim(); return result || null; }
function money(value: number) { return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value); }
function date(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
function message(error: unknown) { return (error as { response?: { data?: { message?: string } }; message?: string }).response?.data?.message ?? (error as Error).message ?? "The operation failed."; }
