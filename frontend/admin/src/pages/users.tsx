import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    KeyRound,
    LoaderCircle,
    Pencil,
    Plus,
    RefreshCw,
    Search,
    Shield,
    UserCheck,
    UserRoundX,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

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
import { tenantService } from "@/features/tenancy/tenant-service";
import type { Branch } from "@/features/tenancy/tenant-types";
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
    const [role, setRole] = useState("");
    const [status, setStatus] = useState<"" | "active" | "inactive">("");
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<AdminUserDetails | null>(null);
    const [form, setForm] = useState<CreateUserRequest>(emptyForm);
    const [passwordUser, setPasswordUser] = useState<AdminUserDetails | null>(null);
    const [newPassword, setNewPassword] = useState("");

    const users = useQuery({
        queryKey: ["admin-users", search, role, status],
        queryFn: () =>
            userService.getUsers({
                search: search || undefined,
                role: role || undefined,
                isActive:
                    status === "active"
                        ? true
                        : status === "inactive"
                          ? false
                          : undefined,
            }),
    });
    const roles = useQuery({
        queryKey: ["admin-roles"],
        queryFn: userService.getRoles,
    });
    const permissions = useQuery({
        queryKey: ["admin-permissions"],
        queryFn: userService.getPermissions,
    });
    const tenantProfile = useQuery({
        queryKey: ["tenant", "profile"],
        queryFn: tenantService.profile,
    });

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
        <div className="space-y-5">
            <PageHeader
                title="Users"
                description="Manage admin and staff accounts, roles, direct permissions, and access status."
                actions={
                    canManage ? (
                        <Button onClick={startCreate}>
                            <Plus /> Add user
                        </Button>
                    ) : undefined
                }
            />

            <div className="grid gap-4 sm:grid-cols-3">
                <SummaryCard
                    label="Total users"
                    value={users.data?.length ?? 0}
                    icon={<Shield />}
                />
                <SummaryCard
                    label="Active"
                    value={users.data?.filter((user) => user.isActive).length ?? 0}
                    icon={<UserCheck />}
                />
                <SummaryCard
                    label="Disabled"
                    value={users.data?.filter((user) => !user.isActive).length ?? 0}
                    icon={<UserRoundX />}
                />
            </div>

            <Card>
                <CardContent className="grid gap-3 md:grid-cols-[1fr_220px_180px_auto]">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                        <Input
                            className="pl-9"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search name, email, or phone..."
                        />
                    </div>
                    <SimpleCombobox
                        value={role}
                        onValueChange={(value) => setRole(value ?? "")}
                        options={[
                            { value: "", label: "All roles" },
                            ...(roles.data ?? []).map((item) => ({ value: item.name, label: item.name })),
                        ]}
                        placeholder="All roles"
                    />
                    <SimpleCombobox<"" | "active" | "inactive">
                        value={status}
                        onValueChange={(value) => setStatus(value ?? "")}
                        options={[
                            { value: "", label: "All statuses" },
                            { value: "active", label: "Active" },
                            { value: "inactive", label: "Disabled" },
                        ]}
                        placeholder="All statuses"
                    />
                    <Button
                        variant="outline"
                        onClick={() => users.refetch()}
                        disabled={users.isFetching}
                    >
                        <RefreshCw
                            className={users.isFetching ? "animate-spin" : ""}
                        />
                        Refresh
                    </Button>
                </CardContent>
            </Card>

            <Card className="overflow-hidden">
                <CardContent className="px-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>User</TableHead>
                                <TableHead>Roles</TableHead>
                                <TableHead>Permissions</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Last login</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.isLoading && (
                                <TableRow>
                                    <TableCell
                                        colSpan={6}
                                        className="h-28 text-center text-muted-foreground"
                                    >
                                        Loading users...
                                    </TableCell>
                                </TableRow>
                            )}
                            {users.data?.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <span className="grid size-9 place-items-center rounded-full bg-primary/10 font-bold text-primary">
                                                {user.fullName.charAt(0).toUpperCase()}
                                            </span>
                                            <div>
                                                <p className="font-semibold">
                                                    {user.fullName}
                                                </p>
                                                <p className="mt-0.5 text-xs text-muted-foreground">
                                                    {user.email ?? user.phone ?? "No contact"}
                                                </p>
                                                <p className="mt-1 text-[11px] text-muted-foreground">
                                                    {user.branchName ?? "Company-wide"}
                                                </p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                            {user.roles.map((item) => (
                                                <Badge key={item} variant="outline">
                                                    {item}
                                                </Badge>
                                            ))}
                                            {!user.roles.length && (
                                                <span className="text-xs text-muted-foreground">
                                                    Direct access only
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary">
                                            {user.permissionCount} effective
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={
                                                user.isActive ? "default" : "destructive"
                                            }
                                        >
                                            {user.isActive ? "Active" : "Disabled"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {user.lastLoginAt
                                            ? new Date(
                                                  user.lastLoginAt,
                                              ).toLocaleString()
                                            : "Never"}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex justify-end gap-1">
                                            {canManage ? (
                                                <>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        title="Edit user"
                                                        onClick={() => void startEdit(user.id)}
                                                    >
                                                        <Pencil />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        title="Reset password"
                                                        onClick={() =>
                                                            void userService
                                                                .getUser(user.id)
                                                                .then(setPasswordUser)
                                                        }
                                                    >
                                                        <KeyRound />
                                                    </Button>
                                                    {user.isActive && (
                                                        <ConfirmActionDialog
                                                            trigger={
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    title="Deactivate"
                                                                    className="text-destructive"
                                                                >
                                                                    <UserRoundX />
                                                                </Button>
                                                            }
                                                            title={`${tr("Deactivate")} ${user.fullName}?`}
                                                            description="The user will no longer be able to sign in. Their roles and permissions remain saved for later reactivation."
                                                            confirmLabel="Deactivate user"
                                                            destructive
                                                            pending={
                                                                deactivate.isPending &&
                                                                deactivate.variables === user.id
                                                            }
                                                            onConfirm={() =>
                                                                deactivate.mutateAsync(user.id)
                                                            }
                                                        />
                                                    )}
                                                </>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">View only</span>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {!users.isLoading && !users.data?.length && (
                                <TableRow>
                                    <TableCell
                                        colSpan={6}
                                        className="h-28 text-center text-muted-foreground"
                                    >
                                        No users match the current filters.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <UserDialog
                open={open}
                onOpenChange={setOpen}
                editing={editing}
                form={form}
                setForm={setForm}
                roles={roles.data ?? []}
                permissionGroups={permissions.data ?? []}
                branches={tenantProfile.data?.branches ?? []}
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
                        <Label>Branch</Label>
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
                                    description: branch.isMain ? "Main branch" : branch.code,
                                }))}
                            placeholder="Company-wide access"
                            emptyText="No active branch found."
                        />
                        <p className="text-xs text-muted-foreground">
                            Leave empty for company-wide access, or restrict operational context to one branch.
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

function SummaryCard({
    label,
    value,
    icon,
}: {
    label: string;
    value: number;
    icon: React.ReactNode;
}) {
    return (
        <Card>
            <CardContent className="flex items-center justify-between p-5">
                <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="mt-1 text-2xl font-bold">{value}</p>
                </div>
                <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary [&_svg]:size-5">
                    {icon}
                </span>
            </CardContent>
        </Card>
    );
}

function errorMessage(error: unknown) {
    return (
        (error as { response?: { data?: { message?: string } } }).response?.data
            ?.message ?? "The request could not be completed."
    );
}
