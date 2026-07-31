import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { useI18n, type TranslationKey } from "@/i18n/i18n-provider";
import { CaretRightIcon } from "@phosphor-icons/react";
import { Link, useLocation } from "react-router-dom";

export interface NavigationItem {
    titleKey: TranslationKey;
    url: string;
    icon?: React.ReactNode;
    items?: { titleKey: TranslationKey; url: string }[];
}

export interface NavigationGroup {
    labelKey: TranslationKey;
    items: NavigationItem[];
}

export function NavMain({ groups }: { groups: NavigationGroup[] }) {
    const { t, language } = useI18n();
    const { pathname } = useLocation();
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
                                item.items?.some((child) =>
                                    matches(child.url),
                                ) === true;

                            if (!item.items?.length) {
                                return (
                                    <SidebarMenuItem key={item.titleKey}>
                                        <SidebarMenuButton
                                            tooltip={t(item.titleKey)}
                                            isActive={active}
                                            render={<Link to={item.url} />}
                                        >
                                            <span className="shrink-0">
                                                {item.icon}
                                            </span>
                                            <span>{t(item.titleKey)}</span>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
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
                                                    <SidebarMenuSubItem
                                                        key={child.titleKey}
                                                    >
                                                        <SidebarMenuSubButton
                                                            isActive={matches(
                                                                child.url,
                                                            )}
                                                            render={
                                                                <Link
                                                                    to={
                                                                        child.url
                                                                    }
                                                                />
                                                            }
                                                        >
                                                            <span>
                                                                {t(
                                                                    child.titleKey,
                                                                )}
                                                            </span>
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
