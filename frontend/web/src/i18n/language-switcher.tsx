import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, Languages } from "lucide-react";

import { Button } from "../shared/components/ui/button";
import { cn } from "../shared/lib/utils";
import { useI18n, type Language } from "./i18n-provider";

const options: Language[] = ["en", "dr", "ps"];

export function LanguageSwitcher() {
    const { language, setLanguage, t } = useI18n();

    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-xl text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    aria-label="Change language"
                >
                    <Languages className="size-5" />
                </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
                <DropdownMenu.Content
                    align="end"
                    sideOffset={8}
                    className="z-50 min-w-44 rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-xl"
                >
                    {options.map((item) => (
                        <DropdownMenu.Item
                            key={item}
                            onSelect={() => setLanguage(item)}
                            className={cn(
                                "flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm outline-none hover:bg-muted focus:bg-muted",
                                language === item && "font-bold text-primary",
                            )}
                        >
                            {t(`language.${item}`)}
                            {language === item && <Check className="size-4" />}
                        </DropdownMenu.Item>
                    ))}
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    );
}
