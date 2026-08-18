import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    KeyRound,
    LoaderCircle,
    Pencil,
    Plus,
    RefreshCw,
    Search,
    Shield,
    SlidersHorizontal,
    Store,
    UserCheck,
    UserRoundX,
    UsersRound,
    X,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ListPagination } from "@/components/list-pagination";
import { PageHeader } from "@/components/page-header";
import { SimpleCombobox } from "@/components/simple-combobox";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { useAdminAuth } from "@/features/auth/auth-context";
import { hasPermission, Permissions } from "@/features/auth/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { PermissionChecklist } from "@/features/users/components/permission-checklist";
import { companyService } from "@/features/company/company-service";
import type { CompanyBranch as Branch } from "@/features/company/company-types";
import { userService } from "@/features/users/user-service";
import { useI18n } from "@/i18n/i18n-provider";
import type {
    AdminUserDetails,
    CreateUserRequest,
    RoleListItem,
} from "@/features/users/user-types";

const emptyForm: CreateUserRequest = {
    fullName: "",
    email: "",
    phone: null,
    password: "",
    isActive: true,
    branchId: null,
    roles: [],
    permissions: [],
};

export default function UsersPage() {
    const queryClient = useQueryClient();
    const { tr } = useI18n();
    const { user: currentUser } = useAdminAuth();
    const canManage = hasPermission(currentUser, Permissions.UsersManage);
    const [search, setSearch] = useState("");
    const deferredSearch = useDeferredValue(search.trim());
    const [shopId, setShopId] = useState<number | null>(null);
    const [role, setRole] = useState("");
    const [status, setStatus] = useState<"" | "active" | "inactive">("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<AdminUserDetails | null>(null);
    const [form, setForm] = useState<CreateUserRequest>(emptyForm);
    const [passwordUser, setPasswordUser] = useState<AdminUserDetails | null>(null);
    const [newPassword, setNewPassword] = useState("");

    const users = useQuery({
        queryKey: ["admin-users", deferredSearch, shopId, role, status, page, pageSize],
        queryFn: () =>
            userService.getUsers({
                search: deferredSearch || undefined,
                role: role || undefined,
                branchId: shopId ?? undefined,
                isActive:
                    status === "active"
                        ? true
                        : status === "inactive"
                          ? false
                          : undefined,
                page,
                pageSize,
            }),
    });
    const userSummary = useQuery({
        queryKey: ["admin-user-summary"],
        queryFn: userService.getSummary,
    });
    const userItems = users.data?.items ?? [];

    useEffect(() => {
        setPage(1);
    }, [deferredSearch, shopId, role, status]);
    const roles = useQuery({
        queryKey: ["admin-roles"],
        queryFn: userService.getRoles,
    });
    const permissions = useQuery({
        queryKey: ["admin-permissions"],
        queryFn: userService.getPermissions,
    });
    const companyProfile = useQuery({
        queryKey: ["company", "profile"],
        queryFn: companyService.profile,
    });

    const shops = useMemo(
        () =>
            [...(companyProfile.data?.branches ?? [])].sort(
                (left, right) =>
                    Number(right.isMain) - Number(left.isMain) ||
                    left.name.localeCompare(right.name),
            ),
        [companyProfile.data?.branches],
    );
    const activeFilterCount =
        Number(Boolean(search.trim())) +
        Number(shopId !== null) +
        Number(Boolean(role)) +
        Number(Boolean(status));
    const hasFilters = activeFilterCount > 0;
    const clearFilters = () => {
        setSearch("");
        setShopId(null);
        setRole("");
        setStatus("");
        setPage(1);
    };

    const save = useMutation({
        mutationFn: async () => {
            const request = {
                fullName: form.fullName,
                email: form.email,
                phone: form.phone || null,
                isActive: form.isActive,
                branchId: form.branchId,
                roles: form.roles,
                permissions: form.permissions,
            };
            return editing
                ? userService.updateUser(editing.id, request)
                : userService.createUser({ ...request, password: form.password });
        },
        onSuccess: async () => {
            toast.success(editing ? "User updated." : "User created.");
            setOpen(false);
            await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
            await queryClient.invalidateQueries({ queryKey: ["admin-user-summary"] });
            await queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
        },
        onError: (error) => toast.error(errorMessage(error)),
    });

    const resetPassword = useMutation({
        mutationFn: () =>
            userService.resetPassword(passwordUser!.id, newPassword),
        onSuccess: () => {
            toast.success("Password reset successfully.");
            setPasswordUser(null);
            setNewPassword("");
        },
        onError: (error) => toast.error(errorMessage(error)),
    });

    const deactivate = useMutation({
        mutationFn: userService.deactivateUser,
        onSuccess: async () => {
            toast.success("User deactivated.");
            await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
            await queryClient.invalidateQueries({ queryKey: ["admin-user-summary"] });
        },
        onError: (error) => toast.error(errorMessage(error)),
    });

    const startCreate = () => {
        setEditing(null);
        setForm(emptyForm);
        setOpen(true);
    };

    const startEdit = async (id: string) => {
        try {
            const user = await userService.getUser(id);
            setEditing(user);
            setForm({
                fullName: user.fullName,
                email: user.email ?? "",
                phone: user.phone,
                password: "",
                isActive: user.isActive,
                branchId: user.branchId,
                roles: [...user.roles],
                permissions: [...user.directPermissions],
            });
            setOpen(true);
        } catch (error) {
            toast.error(errorMessage(error));
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Users"
                description="Manage staff accounts, shop access, roles, direct permissions, and sign-in status from one place."
                actions={
                    canManage ? (
                        <Button onClick={startCreate}>
                            <Plus /> Add user
                        </Button>
                    ) : undefined
                }
            />

            <Card className="gap-0 py-0">
                <CardContent className="grid p-0 sm:grid-cols-3">
                    <SummaryMetric
                        label="Total users"
                        value={userSummary.data?.total ?? 0}
                        helper="All staff accounts"
                        icon={<Shield />}
                    />
                    <SummaryMetric
                        label="Active"
                        value={userSummary.data?.active ?? 0}
                        helper="Can sign in now"
                        icon={<UserCheck />}
                        className="border-t sm:border-s sm:border-t-0"
                    />
                    <SummaryMetric
                        label="Disabled"
                        value={userSummary.data?.disabled ?? 0}
                        helper="Access currently blocked"
                        icon={<UserRoundX />}
                        className="border-t sm:border-s sm:border-t-0"
                    />
                </CardContent>
            </Card>

            <Card className="gap-0 py-0">
                <div className="flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                        <span className="grid size-10 shrink-0 place-items-center bg-primary/10 text-primary">
                            <UsersRound className="size-5" />
                        </span>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="font-heading text-sm font-semibold">User directory</h2>
                                <Badge variant="secondary">{users.data?.totalCount ?? 0} records</Badge>
                                {users.isFetching && !users.isLoading ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                        <LoaderCircle className="size-3 animate-spin" /> Updating
                                    </span>
                                ) : null}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Search people and narrow access by shop, role, or account status.
                            </p>
                        </div>
                    </div>
                    {hasFilters ? (
                        <Button variant="ghost" size="sm" onClick={clearFilters}>
                            <X className="size-4" />
                            Clear {activeFilterCount} {activeFilterCount === 1 ? "filter" : "filters"}
                        </Button>
                    ) : (
                        <span className="text-xs text-muted-foreground">Showing all users</span>
                    )}
                </div>

                <div className="border-b bg-muted/15 px-4 py-4">
                    <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        <SlidersHorizontal className="size-3.5" />
                        Filters
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(280px,1.6fr)_minmax(190px,1fr)_minmax(170px,.85fr)_minmax(170px,.85fr)_auto]">
                        <div className="relative sm:col-span-2 xl:col-span-1">
                            <Search className="pointer-events-none absolute start-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                className="ps-9"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search name, email, or phone..."
                            />
                        </div>
                        <SimpleCombobox<number>
                            value={shopId}
                            onValueChange={(value) => { setShopId(value); setPage(1); }}
                            options={shops.map((shop) => ({
                                value: shop.id,
                                label: shop.name,
                                description: [
                                    shop.code,
                                    shop.isMain ? "Main shop" : null,
                                    !shop.isActive ? "Inactive" : null,
                                ].filter(Boolean).join(" · "),
                            }))}
                            placeholder="All shops"
                            emptyText="No shops found."
                            disabled={companyProfile.isLoading}
                        />
                        <SimpleCombobox
                            value={role}
                            onValueChange={(value) => { setRole(value ?? ""); setPage(1); }}
                            options={[
                                { value: "", label: "All roles" },
                                ...(roles.data ?? []).map((item) => ({ value: item.name, label: item.name })),
                            ]}
                            placeholder="All roles"
                        />
                        <SimpleCombobox<"" | "active" | "inactive">
                            value={status}
                            onValueChange={(value) => { setStatus(value ?? ""); setPage(1); }}
                            options={[
                                { value: "", label: "All statuses" },
                                { value: "active", label: "Active" },
                                { value: "inactive", label: "Disabled" },
                            ]}
                            placeholder="All statuses"
                        />
                        <Button
                            variant="outline"
                            className="w-full xl:w-auto"
                            onClick={() => users.refetch()}
                            disabled={users.isFetching}
                        >
                            <RefreshCw className={users.isFetching ? "animate-spin" : ""} />
                            Refresh
                        </Button>
                    </div>
                </div>

                <div className="min-h-[280px]">
                    <Table className="min-w-[1040px]">
                        <TableHeader className="bg-muted/30">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="w-[280px] px-4">User</TableHead>
                                <TableHead className="w-[180px]">Shop</TableHead>
                                <TableHead className="w-[170px]">Roles</TableHead>
                                <TableHead className="w-[130px]">Access</TableHead>
                                <TableHead className="w-[120px]">Status</TableHead>
                                <TableHead className="w-[170px]">Last login</TableHead>
                                <TableHead className="w-[126px] pe-4 text-end">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-40 text-center">
                                        <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                            <LoaderCircle className="size-4 animate-spin" />
                                            Loading users...
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : null}
                            {users.isError ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-40 text-center">
                                        <div className="mx-auto max-w-md space-y-2">
                                            <p className="font-medium text-destructive">Users could not be loaded.</p>
                                            <p className="text-xs text-muted-foreground">{errorMessage(users.error)}</p>
                                            <Button variant="outline" size="sm" onClick={() => users.refetch()}>
                                                <RefreshCw className="size-3.5" /> Try again
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : null}
                            {!users.isLoading && !users.isError && userItems.map((user) => (
                                <TableRow key={user.id} className="group">
                                    <TableCell className="px-4 py-3">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <span className="grid size-10 shrink-0 place-items-center border bg-primary/10 font-bold text-primary">
                                                {getInitials(user.fullName)}
                                            </span>
                                            <div className="min-w-0">
                                                <p className="truncate font-semibold text-foreground">{user.fullName}</p>
                                                <p className="mt-0.5 max-w-[220px] truncate text-[11px] text-muted-foreground">
                                                    {user.email ?? user.phone ?? "No contact information"}
                                                </p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex max-w-[180px] items-center gap-2">
                                            <span className="grid size-7 shrink-0 place-items-center border bg-muted/30 text-muted-foreground">
                                                <Store className="size-3.5" />
                                            </span>
                                            <div className="min-w-0">
                                                <p className="truncate font-medium">{user.branchName ?? "Company-wide"}</p>
                                                <p className="truncate text-[11px] text-muted-foreground">
                                                    {user.branchId ? "Shop-scoped access" : "All shops"}
                                                </p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex max-w-[170px] flex-wrap gap-1">
                                            {user.roles.slice(0, 2).map((item) => (
                                                <Badge key={item} variant="outline" className="max-w-[120px] truncate">
                                                    {item}
                                                </Badge>
                                            ))}
                                            {user.roles.length > 2 ? (
                                                <Badge variant="secondary">+{user.roles.length - 2}</Badge>
                                            ) : null}
                                            {!user.roles.length ? (
                                                <span className="text-[11px] text-muted-foreground">Direct access only</span>
                                            ) : null}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div>
                                            <p className="font-semibold tabular-nums">{user.permissionCount}</p>
                                            <p className="text-[11px] text-muted-foreground">effective permissions</p>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant="outline"
                                            className={user.isActive
                                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                                : "border-destructive/30 bg-destructive/10 text-destructive"}
                                        >
                                            <span className={user.isActive ? "size-1.5 bg-emerald-500" : "size-1.5 bg-destructive"} />
                                            {user.isActive ? "Active" : "Disabled"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {user.lastLoginAt ? (
                                            <div>
                                                <p className="font-medium">{formatLoginDate(user.lastLoginAt)}</p>
                                                <p className="mt-0.5 text-[11px] text-muted-foreground">{formatLoginTime(user.lastLoginAt)}</p>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">Never signed in</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="pe-4">
                                        <div className="flex justify-end">
                                            {canManage ? (
                                                <div className="inline-flex items-center border bg-background">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="size-8 border-e"
                                                        title="Edit user"
                                                        onClick={() => void startEdit(user.id)}
                                                    >
                                                        <Pencil className="size-3.5" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="size-8 border-e"
                                                        title="Reset password"
                                                        onClick={() =>
                                                            void userService.getUser(user.id).then(setPasswordUser)
                                                        }
                                                    >
                                                        <KeyRound className="size-3.5" />
                                                    </Button>
                                                    {user.isActive ? (
                                                        <ConfirmActionDialog
                                                            trigger={
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    title="Deactivate"
                                                                    className="size-8 text-destructive hover:text-destructive"
                                                                >
                                                                    <UserRoundX className="size-3.5" />
                                                                </Button>
                                                            }
                                                            title={`${tr("Deactivate")} ${user.fullName}?`}
                                                            description="The user will no longer be able to sign in. Their roles and permissions remain saved for later reactivation."
                                                            confirmLabel="Deactivate user"
                                                            destructive
                                                            pending={deactivate.isPending && deactivate.variables === user.id}
                                                            onConfirm={() => deactivate.mutateAsync(user.id)}
                                                        />
                                                    ) : (
                                                        <span className="grid size-8 place-items-center text-[10px] text-muted-foreground" title="Already disabled">
                                                            —
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <Badge variant="outline" className="text-muted-foreground">View only</Badge>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {!users.isLoading && !users.isError && !userItems.length ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-48 text-center">
                                        <div className="mx-auto flex max-w-sm flex-col items-center">
                                            <span className="mb-3 grid size-10 place-items-center border bg-muted/20 text-muted-foreground">
                                                <UsersRound className="size-5" />
                                            </span>
                                            <p className="font-medium">No users match these filters</p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                Try another search, shop, role, or account status.
                                            </p>
                                            {hasFilters ? (
                                                <Button variant="outline" size="sm" className="mt-3" onClick={clearFilters}>
                                                    <X className="size-3.5" /> Clear filters
                                                </Button>
                                            ) : null}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : null}
                        </TableBody>
                    </Table>
                </div>

                <ListPagination
                    page={page}
                    pageSize={pageSize}
                    totalCount={users.data?.totalCount ?? 0}
                    totalPages={users.data?.totalPages}
                    disabled={users.isFetching}
                    onPageChange={setPage}
                    onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
                />
            </Card>

            <UserDialog
                open={open}
                onOpenChange={setOpen}
                editing={editing}
                form={form}
                setForm={setForm}
                roles={roles.data ?? []}
                permissionGroups={permissions.data ?? []}
                branches={companyProfile.data?.branches ?? []}
                saving={save.isPending}
                onSave={() => save.mutate()}
            />

            <Dialog
                open={Boolean(passwordUser)}
                onOpenChange={(value) => !value && setPasswordUser(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reset password</DialogTitle>
                        <DialogDescription>
                            Set a new password for {passwordUser?.fullName}. Existing
                            JWT sessions expire normally, so deactivate the account when
                            immediate blocking is required.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="reset-password">New password</Label>
                        <Input
                            id="reset-password"
                            type="password"
                            value={newPassword}
                            onChange={(event) => setNewPassword(event.target.value)}
                            placeholder="At least 6 characters"
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setPasswordUser(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            disabled={newPassword.length < 6 || resetPassword.isPending}
                            onClick={() => resetPassword.mutate()}
                        >
                            {resetPassword.isPending && (
                                <LoaderCircle className="animate-spin" />
                            )}
                            Reset password
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function UserDialog({
    open,
    onOpenChange,
    editing,
    form,
    setForm,
    roles,
    permissionGroups,
    branches,
    saving,
    onSave,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editing: AdminUserDetails | null;
    form: CreateUserRequest;
    setForm: React.Dispatch<React.SetStateAction<CreateUserRequest>>;
    roles: RoleListItem[];
    permissionGroups: Awaited<ReturnType<typeof userService.getPermissions>>;
    branches: Branch[];
    saving: boolean;
    onSave: () => void;
}) {
    const rolePermissions = useMemo(
        () =>
            new Set(
                roles
                    .filter((role) => form.roles.includes(role.name))
                    .flatMap((role) => role.permissions),
            ),
        [form.roles, roles],
    );

    useEffect(() => {
        if (!open) return;
        // Keep direct permissions separate from permissions inherited by roles.
    }, [open]);

    const toggleRole = (name: string, checked: boolean) =>
        setForm((current) => ({
            ...current,
            roles: checked
                ? [...new Set([...current.roles, name])]
                : current.roles.filter((role) => role !== name),
        }));

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
                <DialogHeader className="pe-10">
                    <DialogTitle className="text-base">
                        {editing ? "Edit user access" : "Create staff user"}
                    </DialogTitle>
                    <DialogDescription>
                        Roles provide reusable permission sets. Direct permissions are
                        additional exceptions for this user only.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-5 border-b pb-5 md:grid-cols-2">
                    <Field
                        label="Full name"
                        value={form.fullName}
                        onChange={(value) =>
                            setForm((current) => ({ ...current, fullName: value }))
                        }
                    />
                    <Field
                        label="Email"
                        type="email"
                        value={form.email}
                        onChange={(value) =>
                            setForm((current) => ({ ...current, email: value }))
                        }
                    />
                    <Field
                        label="Phone"
                        value={form.phone ?? ""}
                        onChange={(value) =>
                            setForm((current) => ({
                                ...current,
                                phone: value || null,
                            }))
                        }
                    />
                    <div className="space-y-2">
                        <Label>Shop</Label>
                        <SimpleCombobox<number>
                            value={form.branchId}
                            onValueChange={(value) =>
                                setForm((current) => ({ ...current, branchId: value }))
                            }
                            options={branches
                                .filter((branch) => branch.isActive)
                                .map((branch) => ({
                                    value: branch.id,
                                    label: branch.name,
                                    description: branch.isMain ? `Main shop · ${branch.code}` : branch.code,
                                }))}
                            placeholder="Company-wide access"
                            emptyText="No active branch found."
                        />
                        <p className="text-xs text-muted-foreground">
                            Leave empty for company-wide access, or restrict operational context to one shop.
                        </p>
                    </div>
                    {!editing && (
                        <Field
                            label="Initial password"
                            type="password"
                            value={form.password}
                            onChange={(value) =>
                                setForm((current) => ({
                                    ...current,
                                    password: value,
                                }))
                            }
                        />
                    )}
                    <div className="flex items-center justify-between border p-3 md:col-span-2">
                        <div>
                            <Label>Account status</Label>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Disabled users cannot sign in, even with a valid password.
                            </p>
                        </div>
                        <Switch
                            checked={form.isActive}
                            onCheckedChange={(value) =>
                                setForm((current) => ({
                                    ...current,
                                    isActive: value,
                                }))
                            }
                        />
                    </div>
                </div>

                <section className="space-y-3">
                    <div>
                        <h3 className="font-semibold">Roles</h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Assign one or more reusable access profiles.
                        </p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {roles.map((role) => (
                            <label
                                key={role.id}
                                className="flex cursor-pointer items-start gap-3 border p-3 hover:bg-muted/30"
                            >
                                <Checkbox
                                    checked={form.roles.includes(role.name)}
                                    onCheckedChange={(value) =>
                                        toggleRole(role.name, value === true)
                                    }
                                />
                                <span>
                                    <span className="block font-medium">
                                        {role.name}
                                    </span>
                                    <span className="mt-1 block text-xs text-muted-foreground">
                                        {role.permissions.length} permissions · {role.userCount}{" "}
                                        users
                                    </span>
                                </span>
                            </label>
                        ))}
                    </div>
                </section>

                <section className="space-y-3 border-t pt-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h3 className="font-semibold">Direct permissions</h3>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Add access not already supplied by a role. Role permissions
                                remain effective even when unchecked here.
                            </p>
                        </div>
                        <Badge variant="secondary">
                            {rolePermissions.size} inherited · {form.permissions.length}{" "}
                            direct
                        </Badge>
                    </div>
                    <PermissionChecklist
                        groups={permissionGroups}
                        selected={form.permissions}
                        onChange={(value) =>
                            setForm((current) => ({
                                ...current,
                                permissions: value,
                            }))
                        }
                    />
                </section>

                <DialogFooter className="sticky bottom-0 border-t bg-popover pt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        disabled={
                            saving ||
                            !form.fullName.trim() ||
                            !form.email.includes("@") ||
                            (!editing && form.password.length < 6)
                        }
                        onClick={onSave}
                    >
                        {saving && <LoaderCircle className="animate-spin" />}
                        {editing ? "Save changes" : "Create user"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function Field({
    label,
    value,
    onChange,
    type = "text",
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: string;
}) {
    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            <Input
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
            />
        </div>
    );
}

function SummaryMetric({
    label,
    value,
    helper,
    icon,
    className = "",
}: {
    label: string;
    value: number;
    helper: string;
    icon: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={`flex items-center gap-4 p-4 sm:p-5 ${className}`}>
            <span className="grid size-10 shrink-0 place-items-center border bg-primary/10 text-primary [&_svg]:size-5">
                {icon}
            </span>
            <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                    <p className="text-xs font-medium text-muted-foreground">{label}</p>
                    <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
                </div>
                <p className="mt-1 truncate text-[11px] text-muted-foreground">{helper}</p>
            </div>
        </div>
    );
}

function getInitials(name: string) {
    return name
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join("") || "U";
}

function formatLoginDate(value: string) {
    return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(new Date(value));
}

function formatLoginTime(value: string) {
    return new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
    }).format(new Date(value));
}

function errorMessage(error: unknown) {
    return (
        (error as { response?: { data?: { message?: string } } }).response?.data
            ?.message ?? "The request could not be completed."
    );
}
