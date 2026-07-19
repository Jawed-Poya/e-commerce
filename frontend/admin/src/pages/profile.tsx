import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import {
    CalendarDays,
    CheckCircle2,
    KeyRound,
    LoaderCircle,
    Mail,
    Phone,
    ShieldCheck,
    UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminAuth } from "@/features/auth/auth-context";
import { profileService } from "@/features/profile/profile-service";

export default function ProfilePage() {
    const auth = useAdminAuth();
    const queryClient = useQueryClient();
    const profile = useQuery({
        queryKey: ["admin-profile"],
        queryFn: profileService.get,
    });
    const [details, setDetails] = useState({
        fullName: "",
        email: "",
        phone: "",
    });
    const [passwords, setPasswords] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
    });

    useEffect(() => {
        if (!profile.data) return;
        setDetails({
            fullName: profile.data.fullName,
            email: profile.data.email ?? "",
            phone: profile.data.phone ?? "",
        });
    }, [profile.data]);

    const saveProfile = useMutation({
        mutationFn: () =>
            profileService.update({
                fullName: details.fullName.trim(),
                email: details.email.trim(),
                phone: details.phone.trim() || null,
            }),
        onSuccess: async () => {
            toast.success("Profile updated successfully.");
            await queryClient.invalidateQueries({
                queryKey: ["admin-profile"],
            });
            await auth.refresh();
        },
        onError: (error) => toast.error(errorMessage(error)),
    });

    const changePassword = useMutation({
        mutationFn: async () => {
            if (passwords.newPassword !== passwords.confirmPassword)
                throw new Error("New passwords do not match.");
            if (passwords.newPassword.length < 6)
                throw new Error("The new password must be at least 6 characters.");

            return profileService.changePassword({
                currentPassword: passwords.currentPassword,
                newPassword: passwords.newPassword,
            });
        },
        onSuccess: () => {
            toast.success("Password changed successfully.");
            setPasswords({
                currentPassword: "",
                newPassword: "",
                confirmPassword: "",
            });
        },
        onError: (error) => toast.error(errorMessage(error)),
    });

    const initials = useMemo(
        () =>
            (profile.data?.fullName ?? auth.user?.fullName ?? "Admin")
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0])
                .join("")
                .toUpperCase(),
        [auth.user?.fullName, profile.data?.fullName],
    );

    if (profile.isLoading) {
        return (
            <div className="grid min-h-[60vh] place-items-center">
                <LoaderCircle className="size-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!profile.data) {
        return (
            <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                    Your profile could not be loaded.
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-5">
            <PageHeader
                title="My profile"
                description="Manage your account details, security, roles, and effective permissions."
            />

            <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
                <Card className="h-fit overflow-hidden">
                    <div className="h-24 bg-gradient-to-br from-primary/90 to-primary/50" />
                    <CardContent className="-mt-12 space-y-5 pb-6">
                        <Avatar className="size-24 border-4 border-background shadow-lg">
                            <AvatarFallback className="text-xl font-bold">
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-xl font-bold">
                                    {profile.data.fullName}
                                </h2>
                                {profile.data.isActive && (
                                    <CheckCircle2 className="size-4 text-emerald-500" />
                                )}
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {profile.data.email}
                            </p>
                        </div>
                        <div className="space-y-3 border-t pt-4 text-sm">
                            <ProfileMeta
                                icon={<ShieldCheck />}
                                label="Roles"
                                value={profile.data.roles.join(", ") || "No role"}
                            />
                            <ProfileMeta
                                icon={<CalendarDays />}
                                label="Member since"
                                value={new Date(
                                    profile.data.createdAt,
                                ).toLocaleDateString()}
                            />
                            <ProfileMeta
                                icon={<UserRound />}
                                label="Last login"
                                value={
                                    profile.data.lastLoginAt
                                        ? new Date(
                                              profile.data.lastLoginAt,
                                          ).toLocaleString()
                                        : "Not recorded"
                                }
                            />
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-5">
                    <Card>
                        <CardHeader>
                            <CardTitle>Account information</CardTitle>
                            <CardDescription>
                                Update the details used to identify your administrator account.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-5 md:grid-cols-2">
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="profile-name">Full name</Label>
                                <div className="relative">
                                    <UserRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        id="profile-name"
                                        className="pl-9"
                                        value={details.fullName}
                                        onChange={(event) =>
                                            setDetails((current) => ({
                                                ...current,
                                                fullName: event.target.value,
                                            }))
                                        }
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="profile-email">Email</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        id="profile-email"
                                        type="email"
                                        className="pl-9"
                                        value={details.email}
                                        onChange={(event) =>
                                            setDetails((current) => ({
                                                ...current,
                                                email: event.target.value,
                                            }))
                                        }
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="profile-phone">Phone</Label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        id="profile-phone"
                                        className="pl-9"
                                        value={details.phone}
                                        onChange={(event) =>
                                            setDetails((current) => ({
                                                ...current,
                                                phone: event.target.value,
                                            }))
                                        }
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end md:col-span-2">
                                <Button
                                    onClick={() => saveProfile.mutate()}
                                    disabled={saveProfile.isPending}
                                >
                                    {saveProfile.isPending && (
                                        <LoaderCircle className="animate-spin" />
                                    )}
                                    Save profile
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Security</CardTitle>
                            <CardDescription>
                                Change your password using your current password for verification.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-5 md:grid-cols-3">
                            <PasswordField
                                id="current-password"
                                label="Current password"
                                value={passwords.currentPassword}
                                onChange={(value) =>
                                    setPasswords((current) => ({
                                        ...current,
                                        currentPassword: value,
                                    }))
                                }
                            />
                            <PasswordField
                                id="new-password"
                                label="New password"
                                value={passwords.newPassword}
                                onChange={(value) =>
                                    setPasswords((current) => ({
                                        ...current,
                                        newPassword: value,
                                    }))
                                }
                            />
                            <PasswordField
                                id="confirm-password"
                                label="Confirm password"
                                value={passwords.confirmPassword}
                                onChange={(value) =>
                                    setPasswords((current) => ({
                                        ...current,
                                        confirmPassword: value,
                                    }))
                                }
                            />
                            <div className="flex justify-end md:col-span-3">
                                <Button
                                    variant="outline"
                                    onClick={() => changePassword.mutate()}
                                    disabled={
                                        changePassword.isPending ||
                                        !passwords.currentPassword ||
                                        !passwords.newPassword ||
                                        !passwords.confirmPassword
                                    }
                                >
                                    {changePassword.isPending ? (
                                        <LoaderCircle className="animate-spin" />
                                    ) : (
                                        <KeyRound />
                                    )}
                                    Change password
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Effective permissions</CardTitle>
                            <CardDescription>
                                Permissions inherited from roles and assigned directly to your account.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-wrap gap-2">
                            {profile.data.permissions.map((permission) => (
                                <Badge key={permission} variant="secondary">
                                    {permission}
                                </Badge>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function PasswordField({
    id,
    label,
    value,
    onChange,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <div className="space-y-2">
            <Label htmlFor={id}>{label}</Label>
            <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    id={id}
                    type="password"
                    autoComplete="new-password"
                    className="pl-9"
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                />
            </div>
        </div>
    );
}

function ProfileMeta({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
}) {
    return (
        <div className="flex items-start gap-3">
            <span className="mt-0.5 text-muted-foreground [&>svg]:size-4">
                {icon}
            </span>
            <span className="min-w-0">
                <small className="block text-xs text-muted-foreground">
                    {label}
                </small>
                <span className="block truncate font-medium">{value}</span>
            </span>
        </div>
    );
}

function errorMessage(error: unknown) {
    if (error instanceof Error && !isAxiosError(error)) return error.message;
    if (isAxiosError(error)) {
        return (
            (error.response?.data as { message?: string } | undefined)?.message ??
            "The request could not be completed."
        );
    }
    return "The request could not be completed.";
}
