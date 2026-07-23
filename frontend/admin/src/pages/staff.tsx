import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Banknote, CreditCard, LoaderCircle, Pencil, Save, Trash2, UserRoundPlus, UsersRound } from "lucide-react";
import { toast } from "sonner";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAdminAuth } from "@/features/auth/auth-context";
import { hasPermission, Permissions } from "@/features/auth/permissions";
import { PaymentBadge, PaymentLedgerDialog } from "@/features/operations/components/payment-ledger-dialog";
import { operationKeys, useOperationQuery } from "@/features/operations/operations-hooks";
import { operationsService } from "@/features/operations/operations-service";
import type { SalaryPayment, Staff } from "@/features/operations/operations-types";

const today = () => new Date().toISOString().slice(0, 10);
const current = new Date();
const blankStaff = { employeeNumber: "", fullName: "", phone: "", email: "", position: "", department: "", hireDate: today(), baseSalary: 0, isActive: true, address: "", notes: "" };

export default function StaffPage() {
    const queryClient = useQueryClient();
    const { user } = useAdminAuth();
    const canManageStaff = hasPermission(user, Permissions.StaffManage);
    const canViewPayroll = hasPermission(user, Permissions.PayrollView);
    const canManagePayroll = hasPermission(user, Permissions.PayrollManage);
    const { data: staff, isLoading } = useOperationQuery(operationKeys.staff, operationsService.staff);
    const { data: salaries, isLoading: salariesLoading } = useOperationQuery(operationKeys.salaries, operationsService.salaries, canViewPayroll);
    const [tab, setTab] = useState<"staff" | "salary">("staff");
    const [staffOpen, setStaffOpen] = useState(false);
    const [salaryOpen, setSalaryOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<number | null>(null);
    const [editing, setEditing] = useState<Staff | null>(null);
    const [selectedSalary, setSelectedSalary] = useState<SalaryPayment | null>(null);
    const [form, setForm] = useState(blankStaff);
    const [salary, setSalary] = useState({ staffId: 0, periodYear: current.getFullYear(), periodMonth: current.getMonth() + 1, bonus: 0, deduction: 0, paidAmount: 0, paidDate: today(), paymentMethod: "Cash", referenceNumber: "", notes: "" });
    const selectedStaff = useMemo(() => staff?.find((item) => item.id === salary.staffId), [staff, salary.staffId]);
    const netSalary = Math.max(0, (selectedStaff?.baseSalary ?? 0) + salary.bonus - salary.deduction);

    const openCreate = () => { setEditing(null); setForm(blankStaff); setStaffOpen(true); };
    const openEdit = (item: Staff) => { setEditing(item); setForm({ employeeNumber: item.employeeNumber, fullName: item.fullName, phone: item.phone ?? "", email: item.email ?? "", position: item.position ?? "", department: item.department ?? "", hireDate: item.hireDate, baseSalary: item.baseSalary, isActive: item.isActive, address: item.address ?? "", notes: item.notes ?? "" }); setStaffOpen(true); };
    const saveStaff = async () => {
        if (!form.employeeNumber.trim() || !form.fullName.trim()) return toast.error("Employee number and full name are required.");
        setSaving(true);
        try { await operationsService.saveStaff(editing?.id ?? null, { ...form, phone: nullable(form.phone), email: nullable(form.email), position: nullable(form.position), department: nullable(form.department), address: nullable(form.address), notes: nullable(form.notes) }); await queryClient.invalidateQueries({ queryKey: operationKeys.staff }); toast.success(editing ? "Staff member updated." : "Staff member created."); setStaffOpen(false); }
        catch (error) { toast.error(message(error)); } finally { setSaving(false); }
    };
    const remove = async (id: number) => {
        setDeleting(id);
        try { await operationsService.deleteStaff(id); await queryClient.invalidateQueries({ queryKey: operationKeys.staff }); toast.success("Staff member archived."); }
        catch (error) { toast.error(message(error)); throw error; } finally { setDeleting(null); }
    };
    const saveSalary = async () => {
        if (!salary.staffId) return toast.error("Select a staff member.");
        if (salary.paidAmount < 0 || salary.paidAmount > netSalary) return toast.error("Opening payment must be between zero and the net salary.");
        setSaving(true);
        try {
            await operationsService.createSalary({ ...salary, referenceNumber: nullable(salary.referenceNumber), notes: nullable(salary.notes) });
            await Promise.all([queryClient.invalidateQueries({ queryKey: operationKeys.salaries }), queryClient.invalidateQueries({ queryKey: operationKeys.summary })]);
            toast.success("Salary obligation created."); setSalaryOpen(false); setSalary((x) => ({ ...x, staffId: 0, bonus: 0, deduction: 0, paidAmount: 0, referenceNumber: "", notes: "" }));
        } catch (error) { toast.error(message(error)); } finally { setSaving(false); }
    };

    return <div className="space-y-6">
        <PageHeader title="Staff and payroll" description="Maintain staff profiles and monthly salary obligations with partial-payment history." actions={canManagePayroll || canManageStaff ? <div className="flex flex-wrap gap-2">{canManagePayroll ? <Button variant="outline" onClick={() => setSalaryOpen(true)}><Banknote className="me-2 size-4" />Create salary</Button> : null}{canManageStaff ? <Button onClick={openCreate}><UserRoundPlus className="me-2 size-4" />New staff</Button> : null}</div> : undefined} />
        <div className="inline-flex rounded-lg border bg-muted/40 p-1"><Button size="sm" variant={tab === "staff" ? "default" : "ghost"} onClick={() => setTab("staff")}><UsersRound className="me-2 size-4" />Staff</Button>{canViewPayroll ? <Button size="sm" variant={tab === "salary" ? "default" : "ghost"} onClick={() => setTab("salary")}><Banknote className="me-2 size-4" />Payroll</Button> : null}</div>
        {tab === "staff" ? <Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Position</TableHead><TableHead>Department</TableHead><TableHead>Contact</TableHead><TableHead className="text-end">Base salary</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader><TableBody>{isLoading ? <Loading colSpan={7} /> : staff?.length ? staff.map((item) => <TableRow key={item.id}><TableCell><p className="font-medium">{item.fullName}</p><p className="text-xs text-muted-foreground">{item.employeeNumber}</p></TableCell><TableCell>{item.position ?? "—"}</TableCell><TableCell>{item.department ?? "—"}</TableCell><TableCell>{item.phone ?? "—"}<p className="text-xs text-muted-foreground">{item.email}</p></TableCell><TableCell className="text-end">{money(item.baseSalary)}</TableCell><TableCell><Badge variant={item.isActive ? "default" : "outline"}>{item.isActive ? "Active" : "Inactive"}</Badge></TableCell><TableCell>{canManageStaff ? <div className="flex justify-end"><Button size="icon" variant="ghost" onClick={() => openEdit(item)}><Pencil className="size-4" /></Button><ConfirmActionDialog trigger={<Button size="icon" variant="ghost"><Trash2 className="size-4 text-destructive" /></Button>} title="Archive staff member?" description="The profile becomes inactive while salary history remains available." confirmLabel="Archive staff" destructive pending={deleting === item.id} onConfirm={() => remove(item.id)} /></div> : null}</TableCell></TableRow>) : <Empty colSpan={7} text="No staff members have been added." />}</TableBody></Table></CardContent></Card> : <Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Staff</TableHead><TableHead>Period</TableHead><TableHead className="text-end">Net salary</TableHead><TableHead className="text-end">Paid</TableHead><TableHead className="text-end">Balance</TableHead><TableHead>Status</TableHead><TableHead>Opening date</TableHead><TableHead /></TableRow></TableHeader><TableBody>{salariesLoading ? <Loading colSpan={8} /> : salaries?.length ? salaries.map((item) => <TableRow key={item.id}><TableCell className="font-medium">{item.staffName}</TableCell><TableCell>{monthName(item.periodMonth)} {item.periodYear}</TableCell><TableCell className="text-end">{money(item.netAmount)}</TableCell><TableCell className="text-end">{money(item.paidAmount)}</TableCell><TableCell className="text-end">{money(item.remainingAmount)}</TableCell><TableCell><PaymentBadge status={item.paymentStatus} /></TableCell><TableCell>{date(item.paidDate)}</TableCell><TableCell><Button size="sm" variant="outline" onClick={() => setSelectedSalary(item)}><CreditCard className="me-2 size-4" />Payments</Button></TableCell></TableRow>) : <Empty colSpan={8} text="No salary obligations have been created." />}</TableBody></Table></CardContent></Card>}

        <Dialog open={staffOpen} onOpenChange={setStaffOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>{editing ? "Edit staff member" : "New staff member"}</DialogTitle><DialogDescription>Keep employment and salary information together.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><Field label="Employee number *"><Input value={form.employeeNumber} onChange={(event) => setForm((x) => ({ ...x, employeeNumber: event.target.value }))} /></Field><Field label="Full name *"><Input value={form.fullName} onChange={(event) => setForm((x) => ({ ...x, fullName: event.target.value }))} /></Field><Field label="Position"><Input value={form.position} onChange={(event) => setForm((x) => ({ ...x, position: event.target.value }))} /></Field><Field label="Department"><Input value={form.department} onChange={(event) => setForm((x) => ({ ...x, department: event.target.value }))} /></Field><Field label="Phone"><Input value={form.phone} onChange={(event) => setForm((x) => ({ ...x, phone: event.target.value }))} /></Field><Field label="Email"><Input type="email" value={form.email} onChange={(event) => setForm((x) => ({ ...x, email: event.target.value }))} /></Field><Field label="Hire date"><Input type="date" value={form.hireDate} onChange={(event) => setForm((x) => ({ ...x, hireDate: event.target.value }))} /></Field><Field label="Base salary"><Input type="number" min={0} step="0.01" value={form.baseSalary} onChange={(event) => setForm((x) => ({ ...x, baseSalary: Number(event.target.value) }))} /></Field><div className="space-y-2 sm:col-span-2"><Label>Address</Label><Textarea value={form.address} onChange={(event) => setForm((x) => ({ ...x, address: event.target.value }))} /></div><div className="space-y-2 sm:col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(event) => setForm((x) => ({ ...x, notes: event.target.value }))} /></div><label className="flex items-center gap-2"><Checkbox checked={form.isActive} onCheckedChange={(checked) => setForm((x) => ({ ...x, isActive: checked === true }))} />Active staff member</label></div><DialogFooter><Button variant="outline" onClick={() => setStaffOpen(false)}>Cancel</Button><Button onClick={() => void saveStaff()} disabled={saving}><Save className="me-2 size-4" />Save staff</Button></DialogFooter></DialogContent></Dialog>
        <Dialog open={salaryOpen} onOpenChange={setSalaryOpen}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Create salary obligation</DialogTitle><DialogDescription>Create one monthly salary record, optionally pay part now, and settle the remainder later.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><Field label="Staff member"><select className="h-9 w-full border bg-background px-3 text-sm" value={salary.staffId} onChange={(event) => setSalary((x) => ({ ...x, staffId: Number(event.target.value), paidAmount: 0 }))}><option value={0}>Select staff</option>{staff?.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.fullName} · {money(item.baseSalary)}</option>)}</select></Field><Field label="Period"><div className="grid grid-cols-2 gap-2"><select className="h-9 border bg-background px-3 text-sm" value={salary.periodMonth} onChange={(event) => setSalary((x) => ({ ...x, periodMonth: Number(event.target.value) }))}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{monthName(index + 1)}</option>)}</select><Input type="number" min={2000} max={2100} value={salary.periodYear} onChange={(event) => setSalary((x) => ({ ...x, periodYear: Number(event.target.value) }))} /></div></Field><Field label="Bonus"><Input type="number" min={0} step="0.01" value={salary.bonus} onChange={(event) => setSalary((x) => ({ ...x, bonus: Number(event.target.value), paidAmount: 0 }))} /></Field><Field label="Deduction"><Input type="number" min={0} step="0.01" value={salary.deduction} onChange={(event) => setSalary((x) => ({ ...x, deduction: Number(event.target.value), paidAmount: 0 }))} /></Field><Field label="Opening paid amount"><Input type="number" min={0} max={netSalary} step="0.01" value={salary.paidAmount} onChange={(event) => setSalary((x) => ({ ...x, paidAmount: Number(event.target.value) }))} /></Field><Field label="Payment date"><Input type="date" value={salary.paidDate} onChange={(event) => setSalary((x) => ({ ...x, paidDate: event.target.value }))} /></Field><Field label="Payment method"><select className="h-9 w-full border bg-background px-3 text-sm" value={salary.paymentMethod} onChange={(event) => setSalary((x) => ({ ...x, paymentMethod: event.target.value }))}><option>Cash</option><option>Bank transfer</option><option>Cheque</option><option>Other</option></select></Field><Field label="Reference"><Input value={salary.referenceNumber} onChange={(event) => setSalary((x) => ({ ...x, referenceNumber: event.target.value }))} /></Field><div className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:col-span-2 sm:grid-cols-3"><Summary label="Net salary" value={netSalary} /><Summary label="Pay now" value={salary.paidAmount} /><Summary label="Remaining" value={Math.max(0, netSalary - salary.paidAmount)} /></div><div className="space-y-2 sm:col-span-2"><Label>Notes</Label><Textarea rows={3} value={salary.notes} onChange={(event) => setSalary((x) => ({ ...x, notes: event.target.value }))} /></div></div><DialogFooter><Button variant="outline" onClick={() => setSalaryOpen(false)}>Cancel</Button><Button onClick={() => void saveSalary()} disabled={saving || !salary.staffId}><Save className="me-2 size-4" />Create salary</Button></DialogFooter></DialogContent></Dialog>
        {selectedSalary ? <PaymentLedgerDialog open={Boolean(selectedSalary)} onOpenChange={(next) => { if (!next) setSelectedSalary(null); }} title="Salary payments" description={`${selectedSalary.staffName} · ${monthName(selectedSalary.periodMonth)} ${selectedSalary.periodYear}`} documentNumber={`PAY-${selectedSalary.id}`} total={selectedSalary.netAmount} paidAmount={selectedSalary.paidAmount} remainingAmount={selectedSalary.remainingAmount} paymentStatus={selectedSalary.paymentStatus} queryKey={operationKeys.salaryPayments(selectedSalary.id)} loadPayments={() => operationsService.salaryPayments(selectedSalary.id)} addPayment={(body) => operationsService.addSalaryPayment(selectedSalary.id, body)} invalidate={[operationKeys.salaries, operationKeys.summary]} canManage={canManagePayroll} /> : null}
    </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
function Summary({ label, value }: { label: string; value: number }) { return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-bold">{money(value)}</p></div>; }
function Loading({ colSpan }: { colSpan: number }) { return <TableRow><TableCell colSpan={colSpan} className="h-32 text-center"><LoaderCircle className="mx-auto size-5 animate-spin" /></TableCell></TableRow>; }
function Empty({ colSpan, text }: { colSpan: number; text: string }) { return <TableRow><TableCell colSpan={colSpan} className="h-32 text-center text-muted-foreground">{text}</TableCell></TableRow>; }
function nullable(value: string) { const result = value.trim(); return result || null; }
function money(value: number) { return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value); }
function date(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
function monthName(month: number) { return new Intl.DateTimeFormat(undefined, { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2024, month - 1, 1))); }
function message(error: unknown) { return (error as { response?: { data?: { message?: string } }; message?: string }).response?.data?.message ?? (error as Error).message ?? "The operation failed."; }
