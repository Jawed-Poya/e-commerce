import { Bell, ChevronDown, Languages, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/toggle-theme";

function AppHeader() {
    return (
        <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-sm supports-backdrop-filter:bg-background/20            ">
            {/* Left */}
            <div className="flex items-center gap-3">
                <SidebarTrigger />

                <Separator orientation="vertical" className="h-6" />

                <h1 className="text-sm font-semibold">Dashboard</h1>
            </div>

            {/* Right */}
            <div className="flex items-center gap-2">
                {/* Language */}
                <DropdownMenu>
                    <DropdownMenuTrigger>
                        <Button variant="ghost" size="icon">
                            <Languages className="h-5 w-5" />
                        </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end">
                        <DropdownMenuItem>English</DropdownMenuItem>

                        <DropdownMenuItem>فارسی</DropdownMenuItem>

                        <DropdownMenuItem>العربية</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Theme */}
                <ThemeToggle />

                {/* Notifications */}
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />

                    <span
                        className="
                            absolute
                            right-1
                            top-1
                            flex
                            h-2
                            w-2
                            rounded-full
                            bg-red-500
                        "
                    />
                </Button>

                {/* User */}
                <DropdownMenu>
                    <DropdownMenuTrigger>
                        <Button variant="ghost" className="gap-2">
                            <div
                                className="
                                    flex
                                    h-8
                                    w-8
                                    items-center
                                    justify-center
                                    rounded-full
                                    bg-primary
                                    text-primary-foreground
                                    text-sm
                                    font-medium
                                "
                            >
                                A
                            </div>

                            <ChevronDown className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end">
                        <DropdownMenuItem>Profile</DropdownMenuItem>

                        <DropdownMenuItem>Settings</DropdownMenuItem>

                        <DropdownMenuItem>Logout</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
}

export default AppHeader;
