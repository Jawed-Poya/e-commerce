import { Bell, ChevronDown, Languages } from "lucide-react";
import { HeaderNavUser } from "@/components/nav-user";
import { ThemeToggle } from "@/components/toggle-theme";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useI18n, type Language } from "@/i18n/i18n-provider";

const languages: Language[] = ["en", "ps", "dr"];

function AppHeader() {
    const { language, setLanguage, t } = useI18n();

    return <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-sm supports-backdrop-filter:bg-background/20">
        <div className="flex items-center gap-3"><SidebarTrigger /><Separator orientation="vertical" className="h-6" /><h1 className="text-sm font-semibold">{t("nav.dashboard")}</h1></div>
        <div className="flex items-center gap-1">
            <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" className="h-8 gap-2 px-2" />}><Languages className="size-4" /><span className="hidden text-xs sm:inline">{t(`language.${language}`)}</span><ChevronDown className="size-3.5 text-muted-foreground" /></DropdownMenuTrigger>
                <DropdownMenuContent className="w-44" align="end">{languages.map(item => <DropdownMenuItem key={item} onClick={() => setLanguage(item)}>{t(`language.${item}`)}</DropdownMenuItem>)}</DropdownMenuContent>
            </DropdownMenu>
            <ThemeToggle />
            <Button variant="ghost" size="icon" className="relative"><Bell className="size-5" /><span data-slot="notification-indicator" className="absolute right-1 top-1 size-2 rounded-full bg-red-500" /><span className="sr-only">{t("common.notifications")}</span></Button>
            <HeaderNavUser />
        </div>
    </header>;
}

export default AppHeader;
