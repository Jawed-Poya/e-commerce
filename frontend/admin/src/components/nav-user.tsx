import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import {
    CaretUpDownIcon,
    CheckCircleIcon,
    SignOutIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/i18n-provider";

export const adminUser = {
    name: "Admin",
    email: "admin@example.com",
    avatar: "/avatars/admin.jpg",
};

type User = typeof adminUser;

function UserDropdownContent({ user, side = "bottom" }: { user: User; side?: "bottom" | "right" }) {
    const { t } = useI18n();
    return <DropdownMenuContent className="w-64" side={side} align="end" sideOffset={4}>
        <DropdownMenuGroup><DropdownMenuLabel className="p-0 font-normal"><div className="flex items-center gap-2 px-2 py-2 text-start text-sm"><Avatar><AvatarImage src={user.avatar} alt={user.name} /><AvatarFallback>{user.name.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar><div className="grid min-w-0 flex-1 text-start leading-tight"><span className="truncate font-medium">{user.name}</span><span className="truncate text-xs text-muted-foreground">{user.email}</span></div></div></DropdownMenuLabel></DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup><DropdownMenuItem><CheckCircleIcon />{t("common.profile")}</DropdownMenuItem></DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem><SignOutIcon />{t("common.logout")}</DropdownMenuItem>
    </DropdownMenuContent>;
}

export function HeaderNavUser({ user = adminUser }: { user?: User }) {
    return <DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-8 p-0" aria-label="Open user menu" />}><Avatar size="sm"><AvatarImage src={user.avatar} alt={user.name} /><AvatarFallback>{user.name.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar></DropdownMenuTrigger><UserDropdownContent user={user} /></DropdownMenu>;
}

export function NavUser({
    user,
}: {
    user: User;
}) {
    const { isMobile } = useSidebar();
    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger
                        render={
                            <SidebarMenuButton
                                size="lg"
                                className="aria-expanded:bg-muted"
                            />
                        }
                    >
                        <Avatar>
                            <AvatarImage src={user.avatar} alt={user.name} />
                            <AvatarFallback>CN</AvatarFallback>
                        </Avatar>
                        <div className="grid flex-1 text-start text-sm leading-tight">
                            <span className="truncate font-medium">
                                {user.name}
                            </span>
                            <span className="truncate text-xs">
                                {user.email}
                            </span>
                        </div>
                        <CaretUpDownIcon className="ms-auto size-4" />
                    </DropdownMenuTrigger>
                    <UserDropdownContent user={user} side={isMobile ? "bottom" : "right"} />
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
