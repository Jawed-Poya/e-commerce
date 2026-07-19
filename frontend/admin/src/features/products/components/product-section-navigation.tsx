import { NavLink } from "react-router-dom";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/i18n-provider";

export function ProductSectionNavigation() {
    const { t } = useI18n();

    return (
        <nav aria-label={t("products.navigation")} className="flex items-center gap-1 border-b" role="navigation">
            <NavLink end to="/products" className={({ isActive }) => cn(buttonVariants({ variant: "ghost", size: "sm" }), "border-b-2 border-transparent", isActive && "border-primary bg-muted text-foreground")}>{t("nav.allProducts")}</NavLink>
            <NavLink to="/products/new" className={({ isActive }) => cn(buttonVariants({ variant: "ghost", size: "sm" }), "border-b-2 border-transparent", isActive && "border-primary bg-muted text-foreground")}>{t("products.bulkCreate")}</NavLink>
        </nav>
    );
}
