import { ChevronDown, Languages } from "lucide-react";
import { HeaderNavUser } from "@/components/nav-user";
import { ThemeToggle } from "@/components/toggle-theme";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useI18n, type Language } from "@/i18n/i18n-provider";
import { AdminNotificationCenter } from "@/features/notifications/admin-notification-center";
import { useCompany } from "@/features/company/company-context";
import { OfflineStatus } from "@/features/offline/offline-status";

const languages: Language[] = ["en", "ps", "dr"];

function AppHeader() {
    const { language, setLanguage, t } = useI18n();
    const { company } = useCompany();

    return <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background/90 px-2 backdrop-blur-xl sm:px-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3"><SidebarTrigger /><Separator orientation="vertical" className="hidden h-6 sm:block" /><div className="min-w-0"><h1 className="truncate text-sm font-semibold">{company?.name ?? t("nav.dashboard")}</h1><p className="hidden truncate text-[10px] text-muted-foreground sm:block">Single-company commerce system</p></div></div>
        <div className="flex items-center gap-1">
            <DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" className="hidden h-8 gap-2 px-2 sm:inline-flex" />}><Languages className="size-4" /><span className="text-xs">{t(`language.${language}`)}</span><ChevronDown className="size-3.5 text-muted-foreground" /></DropdownMenuTrigger><DropdownMenuContent className="w-44" align="end">{languages.map((item) => <DropdownMenuItem key={item} onClick={() => setLanguage(item)}>{t(`language.${item}`)}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
            <OfflineStatus /><span className="hidden sm:inline-flex"><ThemeToggle /></span><AdminNotificationCenter /><HeaderNavUser />
        </div>
    </header>;
}
export default AppHeader;
