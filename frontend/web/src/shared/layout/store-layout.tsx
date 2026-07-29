import * as Dialog from "@radix-ui/react-dialog";
import {
    Check,
    CircleHelp,
    Heart,
    Mail,
    MapPin,
    Menu,
    Phone,
    Share2,
    ShoppingBag,
    Store,
    UserRound,
    X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../../features/auth/auth-context";
import { useCart } from "../../features/cart/cart-context";
import {
    CategoryMegaMenu,
    MobileCategoryLinks,
} from "../../features/catalog/category-menu";
import { GlobalSearch } from "../../features/catalog/global-search";
import { useLookups } from "../../features/catalog/use-catalog";
import { useCompany } from "../../features/company/company-context";
import { NotificationCenter } from "../../features/notifications/notification-center";
import { PwaInstallButton } from "../../features/pwa/pwa-install-button";
import { LanguageSwitcher } from "../../i18n/language-switcher";
import { useI18n } from "../../i18n/i18n-provider";
import { imageUrl } from "../api/api-client";
import { ThemeToggle } from "../components/theme-toggle";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";

type StoreNavItem = {
    to: string;
    label: string;
    match: "home" | "products" | "section" | "exact";
    section?: "categories" | "deals";
};

const nav: StoreNavItem[] = [
    { to: "/", label: "nav.home", match: "home" },
    { to: "/products", label: "nav.shop", match: "products" },
    {
        to: "/?section=categories#categories",
        label: "nav.categories",
        match: "section",
        section: "categories",
    },
    {
        to: "/?section=deals#deals",
        label: "nav.deals",
        match: "section",
        section: "deals",
    },
    { to: "/track-order", label: "nav.trackOrder", match: "exact" },
];

function isStoreNavItemActive(
    item: StoreNavItem,
    pathname: string,
    search: string,
) {
    const selectedSection = new URLSearchParams(search).get("section");
    if (item.match === "home") return pathname === "/" && !selectedSection;
    if (item.match === "products")
        return pathname === "/products" || pathname.startsWith("/products/");
    if (item.match === "section")
        return pathname === "/" && selectedSection === item.section;
    return pathname === item.to;
}

function Logo({ inverse = false }: { inverse?: boolean }) {
    const { company } = useCompany();
    const name = company?.name ?? "EasyCart";
    const initials = name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase();

    return (
        <Link viewTransition
            to="/"
            className="group flex min-w-0 shrink-0 items-center gap-2.5 font-black tracking-tight"
        >
            <span className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-brand-orange text-xs text-primary-foreground shadow-lg shadow-primary/20 transition duration-300 group-hover:-rotate-3 group-hover:scale-105">
                {company?.logoUrl ? (
                    <img
                        src={imageUrl(company.logoUrl) ?? company.logoUrl}
                        alt=""
                        className="size-full object-contain bg-white p-1 dark:bg-slate-950"
                    />
                ) : (
                    <span className="relative z-10">{initials}</span>
                )}
                <span className="absolute -end-2 -top-2 size-6 rounded-full bg-white/20" />
            </span>
            <span
                className={cn(
                    "max-w-36 truncate text-xl tracking-[-0.04em] sm:max-w-48",
                    inverse ? "text-white" : "text-foreground",
                )}
            >
                {name}
            </span>
        </Link>
    );
}

export function StoreLayout() {
    const [mobileOpen, setMobileOpen] = useState(false);
    const [shareConfirmed, setShareConfirmed] = useState(false);
    const location = useLocation();
    const cart = useCart();
    const auth = useAuth();
    const { t } = useI18n();
    const { company } = useCompany();
    const lookups = useLookups();
    const accountPath = auth.isAuthenticated ? "/account" : "/account/login";
    const roots = (lookups.data?.categories ?? []).filter(
        (category) => category.parentId == null,
    );

    const shareStore = async () => {
        const url = window.location.href;
        const title = company?.name ?? "Online store";
        if (navigator.share) {
            try {
                await navigator.share({
                    title,
                    text: t("common.shareStoreText"),
                    url,
                });
                return;
            } catch (error) {
                if ((error as DOMException)?.name === "AbortError") return;
            }
        }
        try {
            await navigator.clipboard.writeText(url);
            setShareConfirmed(true);
            window.setTimeout(() => setShareConfirmed(false), 1800);
        } catch {
            window.prompt(t("common.copyStoreLink"), url);
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground">
            <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 shadow-[0_1px_16px_rgba(15,23,42,0.04)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 dark:shadow-[0_1px_20px_rgba(0,0,0,0.25)]">
                <div className="border-b border-border/60 bg-primary/[0.04] dark:border-white/10 dark:bg-slate-950">
                    <div className="mx-auto flex h-9 w-full max-w-[1500px] items-center justify-between gap-4 px-4 text-[11px] sm:px-6 lg:px-8">
                        <div className="flex min-w-0 items-center gap-2">
                            <span className="relative flex size-2 shrink-0">
                                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                            </span>
                            <span className="truncate font-medium">
                                {t("header.welcome")}
                            </span>
                        </div>
                        <div className="hidden items-center gap-5 sm:flex">
                            {company?.email ? (
                                <a
                                    href={`mailto:${company.email}`}
                                    className="flex items-center gap-1.5 text-muted-foreground transition hover:text-primary"
                                >
                                    <CircleHelp className="size-3.5" />
                                    {t("header.help")}
                                </a>
                            ) : null}
                            <span className="text-muted-foreground">
                                {t("header.secure")}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="border-b border-border/70 bg-background/95">
                    <div className="mx-auto flex h-[70px] w-full max-w-[1500px] items-center gap-2.5 px-4 sm:h-[76px] sm:px-6 md:gap-5 lg:h-20 lg:px-8">
                        <Logo />
                        <GlobalSearch className="mx-auto hidden w-full max-w-2xl md:block" />
                        <div className="ms-auto flex items-center gap-0.5">
                            <LanguageSwitcher />
                            <PwaInstallButton compact />
                            <ThemeToggle />
                            <NotificationCenter />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="hidden rounded-xl text-muted-foreground hover:bg-primary/10 hover:text-primary sm:inline-flex"
                                aria-label={
                                    shareConfirmed
                                        ? t("common.linkCopied")
                                        : t("common.shareStore")
                                }
                                onClick={() => void shareStore()}
                            >
                                {shareConfirmed ? (
                                    <Check className="size-5 text-emerald-600" />
                                ) : (
                                    <Share2 className="size-5" />
                                )}
                            </Button>
                            <Button
                                asChild
                                variant="ghost"
                                size="icon"
                                className="hidden rounded-xl text-muted-foreground hover:bg-primary/10 hover:text-primary sm:inline-flex"
                            >
                                <Link viewTransition
                                    to={accountPath}
                                    aria-label={
                                        auth.isAuthenticated
                                            ? t("common.account")
                                            : t("common.login")
                                    }
                                >
                                    <UserRound className="size-5" />
                                </Link>
                            </Button>
                            <Button
                                asChild
                                variant="ghost"
                                size="icon"
                                className="relative hidden rounded-xl text-muted-foreground hover:bg-primary/10 hover:text-primary sm:inline-flex"
                            >
                                <Link viewTransition to="/wishlist" aria-label={t("common.wishlist")}>
                                    <Heart className="size-5" />
                                    {cart.wishlist.length ? (
                                        <CountBadge>{cart.wishlist.length}</CountBadge>
                                    ) : null}
                                </Link>
                            </Button>
                            <Button
                                asChild
                                variant="ghost"
                                size="icon"
                                className="relative rounded-xl text-muted-foreground hover:bg-primary/10 hover:text-primary"
                            >
                                <Link viewTransition to="/cart" aria-label={t("common.cart")}>
                                    <ShoppingBag className="size-5" />
                                    {cart.items.length ? (
                                        <CountBadge>{cart.items.length}</CountBadge>
                                    ) : null}
                                </Link>
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="rounded-xl md:hidden"
                                onClick={() => setMobileOpen(true)}
                                aria-label={t("mobile.openMenu")}
                            >
                                <Menu className="size-5" />
                            </Button>
                        </div>
                    </div>
                    <div className="mx-auto w-full max-w-[1500px] px-4 pb-3 md:hidden sm:px-6">
                        <GlobalSearch compact />
                    </div>
                </div>

                <div className="hidden bg-background/95 md:block">
                    <div className="mx-auto flex h-12 w-full max-w-[1500px] items-center gap-2 px-6 lg:px-8">
                        <CategoryMegaMenu />
                        <nav className="ms-1 flex min-w-0 flex-1 items-center justify-center gap-0.5 overflow-hidden lg:ms-2 lg:gap-1">
                            {nav.map((item) => {
                                const active = isStoreNavItemActive(
                                    item,
                                    location.pathname,
                                    location.search,
                                );
                                return (
                                    <Link viewTransition
                                        key={item.to}
                                        to={item.to}
                                        className={cn(
                                            "relative shrink-0 rounded-xl px-2 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground lg:px-3.5 lg:text-sm",
                                            item.to === "/track-order" && "hidden xl:inline-flex",
                                            active &&
                                                "bg-primary/8 text-primary after:absolute after:inset-x-4 after:-bottom-1 after:h-0.5 after:rounded-full after:bg-primary",
                                        )}
                                    >
                                        {t(item.label)}
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>
                </div>
            </header>

            <main>
                <Outlet />
            </main>

            <footer className="mt-16 border-t bg-slate-950 text-slate-200 dark:bg-black">
                <div className="mx-auto grid w-full max-w-[1500px] gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.3fr_.7fr_.8fr_1fr] lg:px-8">
                    <div>
                        <Logo inverse />
                        <p className="mt-5 max-w-md text-sm leading-7 text-slate-400">
                            {company?.legalName ?? company?.name ?? t("footer.onlineStore")}
                        </p>
                        <div className="mt-5 grid gap-2 text-sm text-slate-400">
                            {company?.address ? (
                                <FooterContact icon={<MapPin />} text={company.address} />
                            ) : null}
                            {company?.phone ? (
                                <FooterContact
                                    icon={<Phone />}
                                    text={company.phone}
                                    href={`tel:${company.phone}`}
                                />
                            ) : null}
                            {company?.email ? (
                                <FooterContact
                                    icon={<Mail />}
                                    text={company.email}
                                    href={`mailto:${company.email}`}
                                />
                            ) : null}
                        </div>
                    </div>
                    <FooterColumn title={t("nav.shop")}>
                        <FooterLink to="/products">{t("catalog.allCategories")}</FooterLink>
                        {roots.slice(0, 5).map((category) => (
                            <FooterLink
                                key={category.id}
                                to={`/products?categoryId=${category.id}`}
                            >
                                {category.name}
                            </FooterLink>
                        ))}
                    </FooterColumn>
                    <FooterColumn title={t("common.account")}>
                        <FooterLink to={accountPath}>{t("common.account")}</FooterLink>
                        <FooterLink to="/track-order">{t("nav.trackOrder")}</FooterLink>
                        <FooterLink to="/wishlist">{t("common.wishlist")}</FooterLink>
                        <FooterLink to="/cart">{t("common.cart")}</FooterLink>
                    </FooterColumn>
                    <FooterColumn title={t("footer.locations")}>
                        {(company?.branches ?? []).slice(0, 6).map((branch) => (
                            <div
                                key={branch.id}
                                className="rounded-xl border border-white/10 bg-white/[0.04] p-3"
                            >
                                <p className="flex items-center gap-2 text-sm font-bold text-white">
                                    <Store className="size-4 text-primary" />
                                    {branch.name}
                                </p>
                                {branch.address ? (
                                    <p className="mt-1 text-xs leading-5 text-slate-400">
                                        {branch.address}
                                    </p>
                                ) : null}
                            </div>
                        ))}
                    </FooterColumn>
                </div>
                <div className="border-t border-white/10">
                    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-2 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
                        <span>
                            © {new Date().getFullYear()} {company?.legalName ?? company?.name ?? "EasyCart"}
                        </span>
                        <span>{t("header.secure")}</span>
                    </div>
                </div>
            </footer>

            <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm" />
                    <Dialog.Content className="fixed inset-y-0 end-0 z-50 w-[90%] max-w-sm overflow-y-auto border-s bg-background p-5 shadow-2xl outline-none">
                        <div className="flex items-center justify-between">
                            <Logo />
                            <Dialog.Close asChild>
                                <Button variant="ghost" size="icon" className="rounded-xl">
                                    <X className="size-5" />
                                </Button>
                            </Dialog.Close>
                        </div>
                        <GlobalSearch
                            compact
                            className="mt-6"
                            onNavigate={() => setMobileOpen(false)}
                        />
                        <nav className="mt-6 grid gap-1">
                            {nav.map((item) => (
                                <Link viewTransition
                                    key={item.to}
                                    to={item.to}
                                    onClick={() => setMobileOpen(false)}
                                    className="rounded-xl px-4 py-3 text-sm font-bold transition hover:bg-primary/8 hover:text-primary"
                                >
                                    {t(item.label)}
                                </Link>
                            ))}
                        </nav>
                        <div className="my-5 h-px bg-border" />
                        <MobileCategoryLinks onNavigate={() => setMobileOpen(false)} />
                        <div className="my-5 h-px bg-border" />
                        <div className="grid grid-cols-2 gap-2">
                            <Button asChild variant="outline">
                                <Link viewTransition to={accountPath} onClick={() => setMobileOpen(false)}>
                                    <UserRound className="size-4" />
                                    {t("common.account")}
                                </Link>
                            </Button>
                            <Button asChild variant="outline">
                                <Link viewTransition to="/wishlist" onClick={() => setMobileOpen(false)}>
                                    <Heart className="size-4" />
                                    {t("common.wishlist")}
                                </Link>
                            </Button>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </div>
    );
}

function CountBadge({ children }: { children: ReactNode }) {
    return (
        <span className="absolute end-0 top-0 grid min-w-4 -translate-y-0.5 translate-x-0.5 place-items-center rounded-full bg-brand-orange px-1 text-[9px] font-black leading-4 text-white">
            {children}
        </span>
    );
}

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div>
            <h3 className="text-sm font-black uppercase tracking-[0.14em] text-white">
                {title}
            </h3>
            <div className="mt-5 grid gap-3 text-sm text-slate-400">{children}</div>
        </div>
    );
}

function FooterLink({ to, children }: { to: string; children: ReactNode }) {
    return (
        <Link viewTransition to={to} className="transition hover:translate-x-1 hover:text-white rtl:hover:-translate-x-1">
            {children}
        </Link>
    );
}

function FooterContact({
    icon,
    text,
    href,
}: {
    icon: ReactNode;
    text: string;
    href?: string;
}) {
    const content = (
        <span className="flex items-start gap-2">
            <span className="mt-0.5 [&>svg]:size-4">{icon}</span>
            <span>{text}</span>
        </span>
    );
    return href ? (
        <a href={href} className="transition hover:text-white">
            {content}
        </a>
    ) : (
        content
    );
}
