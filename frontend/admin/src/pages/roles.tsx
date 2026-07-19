import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Pencil, Plus, ShieldCheck, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { PermissionChecklist } from "@/features/users/components/permission-checklist";
import { userService } from "@/features/users/user-service";
import type { RoleListItem, UpsertRoleRequest } from "@/features/users/user-types";

const emptyForm: UpsertRoleRequest = {
    name: "",
    description: null,
    permissions: [],
};

export default function RolesPage() {
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<RoleListItem | null>(null);
    const [form, setForm] = useState<UpsertRoleRequest>(emptyForm);

    const roles = useQuery({
        queryKey: ["admin-roles"],
        queryFn: userService.getRoles,
    });
    const permissions = useQuery({
        queryKey: ["admin-permissions"],
        queryFn: userService.getPermissions,
    });

    const save = useMutation({
        mutationFn: () =>
            editing
                ? userService.updateRole(editing.id, form)
                : userService.createRole(form),
        onSuccess: async () => {
            toast.success(editing ? "Role updated." : "Role created.");
            setOpen(false);
            await queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
            await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
        },
        onError: (error) => toast.error(errorMessage(error)),
    });

    const remove = useMutation({
        mutationFn: userService.deleteRole,
        onSuccess: async () => {
            toast.success("Role deleted.");
            await queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
        },
        onError: (error) => toast.error(errorMessage(error)),
    });

    const startCreate = () => {
        setEditing(null);
        setForm(emptyForm);
        setOpen(true);
    };

    const startEdit = (role: RoleListItem) => {
        setEditing(role);
        setForm({
            name: role.name,
            description: role.description,
            permissions: [...role.permissions],
        });
        setOpen(true);
    };

    return (
        <div className="space-y-5">
            <PageHeader
                title="Roles & permissions"
                description="Create reusable access profiles and control exactly what staff members can do."
                actions={
                    <Button onClick={startCreate}>
                        <Plus /> Add role
                    </Button>
                }
            />

            <Card className="border-primary/20 bg-primary/5">
                <CardContent className="flex gap-3 p-5">
                    <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
                    <div>
                        <p className="font-semibold">Claims-based authorization is active</p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                            Permissions are stored as Identity role/user claims and included in the JWT at login. Users must sign in again after access changes to receive a refreshed token.
                        </p>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {roles.data?.map((role) => (
                    <Card key={role.id} className="overflow-hidden">
                        <CardHeader className="border-b">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        {role.name}
                                        {role.isSystemRole && (
                                            <Badge variant="secondary">System</Badge>
                                        )}
                                    </CardTitle>
                                    <p className="mt-2 min-h-10 text-xs leading-5 text-muted-foreground">
                                        {role.description ?? "No description provided."}
                                    </p>
                                </div>
                                <ShieldCheck className="size-5 text-primary" />
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-4">
                            <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-2 text-muted-foreground">
                                    <Users className="size-4" /> Assigned users
                                </span>
                                <strong>{role.userCount}</strong>
                            </div>
                            <div>
                                <div className="mb-2 flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Permissions</span>
                                    <strong>{role.permissions.length}</strong>
                                </div>
                                <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
                                    {role.permissions.slice(0, 8).map((permission) => (
                                        <Badge key={permission} variant="outline">
                                            {permission}
                                        </Badge>
                                    ))}
                                    {role.permissions.length > 8 && (
                                        <Badge variant="secondary">
                                            +{role.permissions.length - 8} more
                                        </Badge>
                                    )}
                                    {!role.permissions.length && (
                                        <span className="text-xs text-muted-foreground">
                                            No permissions assigned
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-2 border-t pt-4">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => startEdit(role)}
                                >
                                    <Pencil /> Edit
                                </Button>
                                {!role.isSystemRole && (
                                    <ConfirmActionDialog
                                        trigger={
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="text-destructive"
                                                aria-label={`Delete ${role.name}`}
                                            >
                                                <Trash2 />
                                            </Button>
                                        }
                                        title={`Delete ${role.name}?`}
                                        description="This permanently removes the role. It can only be deleted when no users are assigned to it."
                                        confirmLabel="Delete role"
                                        destructive
                                        pending={
                                            remove.isPending &&
                                            remove.variables === role.id
                                        }
                                        onConfirm={() => remove.mutateAsync(role.id)}
                                    />
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
                    <DialogHeader className="pe-10">
                        <DialogTitle className="text-base">
                            {editing ? `Edit ${editing.name}` : "Create role"}
                        </DialogTitle>
                        <DialogDescription>
                            A role is a reusable collection of permission claims. Assign the role to users from the Users page.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 border-b pb-5 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Role name</Label>
                            <Input
                                value={form.name}
                                disabled={editing?.isSystemRole}
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        name: event.target.value,
                                    }))
                                }
                            />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label>Description</Label>
                            <Textarea
                                value={form.description ?? ""}
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        description: event.target.value || null,
                                    }))
                                }
                            />
                        </div>
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold">Permissions</h3>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Select the exact operations allowed for this role.
                                </p>
                            </div>
                            <Badge variant="secondary">
                                {form.permissions.length} selected
                            </Badge>
                        </div>
                        <PermissionChecklist
                            groups={permissions.data ?? []}
                            selected={form.permissions}
                            disabled={editing?.isSystemRole}
                            onChange={(value) =>
                                setForm((current) => ({
                                    ...current,
                                    permissions: value,
                                }))
                            }
                        />
                        {editing?.isSystemRole && (
                            <p className="rounded-lg border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
                                System-role permissions are protected: Admin always receives every permission and Customer receives none.
                            </p>
                        )}
                    </div>
                    <DialogFooter className="sticky bottom-0 border-t bg-popover pt-4">
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            disabled={!form.name.trim() || save.isPending}
                            onClick={() => save.mutate()}
                        >
                            {save.isPending && <LoaderCircle className="animate-spin" />}
                            Save role
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function errorMessage(error: unknown) {
    return (
        (error as { response?: { data?: { message?: string } } }).response?.data
            ?.message ?? "The request could not be completed."
    );
}
