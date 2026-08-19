import { useEffect, useRef, useState, type ReactNode } from "react";
import { CaretRightIcon } from "@phosphor-icons/react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    useSidebar,
} from "@/components/ui/sidebar";
import { useI18n, type TranslationKey } from "@/i18n/i18n-provider";

export interface NavigationItem {
    titleKey: TranslationKey;
    url: string;
    icon?: ReactNode;
    items?: { titleKey: TranslationKey; url: string }[];
}

export interface NavigationGroup {
    labelKey: TranslationKey;
    items: NavigationItem[];
}

export function NavMain({ groups }: { groups: NavigationGroup[] }) {
    const { t, language } = useI18n();
    const { pathname } = useLocation();
    const { state, isMobile, setOpenMobile } = useSidebar();
    const matches = (url: string) =>
        pathname === url ||
        pathname.startsWith(`${url}/`) ||
        (url === "/dashboard" && pathname === "/");

    return (
        <>
            {groups.map((group) => (
                <SidebarGroup key={group.labelKey}>
                    <SidebarGroupLabel>{t(group.labelKey)}</SidebarGroupLabel>
                    <SidebarMenu>
                        {group.items.map((item) => {
                            const active =
                                matches(item.url) ||
                                item.items?.some((child) => matches(child.url)) === true;

                            if (!item.items?.length) {
                                return (
                                    <SidebarMenuItem key={item.titleKey}>
                                        <SidebarMenuButton
                                            tooltip={t(item.titleKey)}
                                            isActive={active}
                                            render={
                                                <Link
                                                    to={item.url}
                                                    onClick={() => setOpenMobile(false)}
                                                />
                                            }
                                        >
                                            <span className="shrink-0">{item.icon}</span>
                                            <span>{t(item.titleKey)}</span>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                );
                            }

                            if (state === "collapsed" && !isMobile) {
                                return (
                                    <CollapsedNavigationMenu
                                        key={item.titleKey}
                                        item={item}
                                        active={active}
                                    />
                                );
                            }

                            return (
                                <Collapsible
                                    key={item.titleKey}
                                    defaultOpen={active}
                                    className="group/collapsible"
                                >
                                    <SidebarMenuItem>
                                        <CollapsibleTrigger className="w-full">
                                            <SidebarMenuButton
                                                tooltip={t(item.titleKey)}
                                                isActive={active}
                                            >
                                                {item.icon}
                                                <span>{t(item.titleKey)}</span>
                                                <CaretRightIcon
                                                    className={`ms-auto size-4 transition-transform group-data-open/collapsible:rotate-90 ${language === "en" ? "" : "rotate-180 group-data-open/collapsible:rotate-90"}`}
                                                />
                                            </SidebarMenuButton>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent>
                                            <SidebarMenuSub>
                                                {item.items.map((child) => (
                                                    <SidebarMenuSubItem key={child.titleKey}>
                                                        <SidebarMenuSubButton
                                                            isActive={matches(child.url)}
                                                            render={
                                                                <Link
                                                                    to={child.url}
                                                                    onClick={() => setOpenMobile(false)}
                                                                />
                                                            }
                                                        >
                                                            <span>{t(child.titleKey)}</span>
                                                        </SidebarMenuSubButton>
                                                    </SidebarMenuSubItem>
                                                ))}
                                            </SidebarMenuSub>
                                        </CollapsibleContent>
                                    </SidebarMenuItem>
                                </Collapsible>
                            );
                        })}
                    </SidebarMenu>
                </SidebarGroup>
            ))}
        </>
    );
}

function CollapsedNavigationMenu({
    item,
    active,
}: {
    item: NavigationItem;
    active: boolean;
}) {
    const { t } = useI18n();
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const [open, setOpen] = useState(false);
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearCloseTimer = () => {
        if (closeTimer.current) {
            clearTimeout(closeTimer.current);
            closeTimer.current = null;
        }
    };

    const scheduleClose = () => {
        clearCloseTimer();
        closeTimer.current = setTimeout(() => setOpen(false), 140);
    };

    useEffect(() => () => clearCloseTimer(), []);

    const isChildActive = (url: string) =>
        pathname === url || pathname.startsWith(`${url}/`);
    const children = item.items ?? [];

    return (
        <SidebarMenuItem
            onPointerEnter={() => {
                clearCloseTimer();
                setOpen(true);
            }}
            onPointerLeave={scheduleClose}
        >
            <DropdownMenu open={open} onOpenChange={setOpen}>
                <DropdownMenuTrigger
                    render={
                        <SidebarMenuButton
                            tooltip={t(item.titleKey)}
                            isActive={active}
                            aria-label={t(item.titleKey)}
                        />
                    }
                >
                    {item.icon}
                    <span>{t(item.titleKey)}</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    side="inline-end"
                    align="start"
                    sideOffset={8}
                    className="w-56"
                    onPointerEnter={clearCloseTimer}
                    onPointerLeave={scheduleClose}
                >
                    <DropdownMenuLabel className="font-semibold text-foreground">
                        {t(item.titleKey)}
                    </DropdownMenuLabel>
                    {children.map((child) => (
                        <DropdownMenuItem
                            key={child.titleKey}
                            className={isChildActive(child.url) ? "bg-accent font-medium" : undefined}
                            onClick={() => {
                                setOpen(false);
                                navigate(child.url);
                            }}
                        >
                            {t(child.titleKey)}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </SidebarMenuItem>
    );
}
