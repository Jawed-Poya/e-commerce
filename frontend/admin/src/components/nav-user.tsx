import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from "@/components/ui/sidebar";
import { CaretUpDownIcon, CheckCircleIcon, SignOutIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/i18n-provider";
import { useAdminAuth } from "@/features/auth/auth-context";

function UserDropdownContent({ side = "bottom" }: { side?: "bottom" | "right" }) {
    const { t } = useI18n();
    const auth = useAdminAuth();
    const user = auth.user;
    if (!user) return null;

    return (
        <DropdownMenuContent className="w-64" side={side} align="end" sideOffset={4}>
            <DropdownMenuGroup>
                <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-2 py-2 text-start text-sm">
                        <Avatar><AvatarFallback>{user.fullName.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                        <div className="grid min-w-0 flex-1 text-start leading-tight">
                            <span className="truncate font-medium">{user.fullName}</span>
                            <span className="truncate text-xs text-muted-foreground">{user.email ?? user.phone ?? "Administrator"}</span>
                        </div>
                    </div>
                </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup><DropdownMenuItem><CheckCircleIcon />{t("common.profile")}</DropdownMenuItem></DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={auth.logout}><SignOutIcon />{t("common.logout")}</DropdownMenuItem>
        </DropdownMenuContent>
    );
}

export function HeaderNavUser() {
    const auth = useAdminAuth();
    const user = auth.user;
    if (!user) return null;
    return (
        <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-8 p-0" aria-label="Open user menu" />}>
                <Avatar size="sm"><AvatarFallback>{user.fullName.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
            </DropdownMenuTrigger>
            <UserDropdownContent />
        </DropdownMenu>
    );
}

export function NavUser() {
    const { isMobile } = useSidebar();
    const auth = useAdminAuth();
    const user = auth.user;
    if (!user) return null;

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger render={<SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />}>
                        <Avatar><AvatarFallback>{user.fullName.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                        <div className="grid flex-1 text-start text-sm leading-tight">
                            <span className="truncate font-medium">{user.fullName}</span>
                            <span className="truncate text-xs">{user.email ?? user.phone}</span>
                        </div>
                        <CaretUpDownIcon className="ms-auto size-4" />
                    </DropdownMenuTrigger>
                    <UserDropdownContent side={isMobile ? "bottom" : "right"} />
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
