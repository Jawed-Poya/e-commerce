import { StoreVisitTracker } from "../../features/analytics/store-visit-tracker";
import * as Dialog from "@radix-ui/react-dialog";
import {
    BadgeCheck,
    Check,
    Heart,
    House,
    LayoutGrid,
    Mail,
    MapPin,
    Menu,
    RotateCcw,
    Phone,
    Share2,
    ShieldCheck,
    ShoppingBag,
    Store,
    Truck,
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
import { formatMoney } from "../lib/money";
import { cn } from "../lib/utils";


const footerTrustItems = [
    {
        icon: ShieldCheck,
        title: "home.secureShopping",
        description: "home.protectedCheckout",
    },
    {
        icon: Truck,
        title: "home.fastDelivery",
        description: "home.deliveryTracking",
    },
    {
        icon: RotateCcw,
        title: "home.easyReturns",
        description: "home.simplePolicy",
    },
    {
        icon: BadgeCheck,
        title: "home.trustedCatalog",
        description: "home.updatedInfo",
    },
] as const;

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
    if (item.match === "products") {
        return pathname === "/products" || pathname.startsWith("/products/");
    }
    if (item.match === "section") {
        return pathname === "/" && selectedSection === item.section;
    }
    return pathname === item.to;
}

function Logo({ inverse = false }: { inverse?: boolean }) {
    const { company } = useCompany();
    const { t } = useI18n();
    const name = company?.name ?? "Default Company";
    const initials = name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase();

    return (
        <Link
            viewTransition
            to="/"
            className="group flex min-w-0 shrink-0 items-center gap-2"
        >
            <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-primary text-xs font-black text-primary-foreground shadow-sm ring-1 ring-black/[0.05] transition duration-200 group-hover:-translate-y-0.5 dark:ring-white/[0.06]">
                {company?.logoUrl ? (
                    <img
                        src={imageUrl(company.logoUrl) ?? company.logoUrl}
                        alt=""
                        className="size-full bg-white object-contain p-1 dark:bg-slate-950"
                    />
                ) : (
                    initials
                )}
            </span>
            <span className="min-w-0">
                <span
                    className={cn(
                        "block max-w-44 truncate text-lg font-black tracking-[-0.035em] sm:max-w-56",
                        inverse ? "text-white" : "text-foreground",
                    )}
                >
                    {name}
                </span>
                <span
                    className={cn(
                        "hidden text-[10px] font-semibold uppercase tracking-[0.12em] sm:block",
                        inverse ? "text-slate-400" : "text-muted-foreground",
                    )}
                >
                    {t("header.pharmacyMarketplace")}
                </span>
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
    const cartSubtotal = cart.items.reduce(
        (total, item) => total + item.price * item.quantity,
        0,
    );
    const primaryBranch =
        company?.branches.find((branch) => branch.isMain && branch.isActive) ??
        company?.branches.find((branch) => branch.isActive);
    const contactPhone = company?.phone ?? primaryBranch?.phone ?? null;
    const contactAddress = company?.address ?? primaryBranch?.address ?? null;
    const mobileNav = [
        {
            to: "/",
            label: t("nav.home"),
            icon: House,
            active: location.pathname === "/",
        },
        {
            to: "/products",
            label: t("nav.shop"),
            icon: LayoutGrid,
            active:
                location.pathname === "/products" ||
                location.pathname.startsWith("/products/"),
        },
        {
            to: "/wishlist",
            label: t("common.wishlist"),
            icon: Heart,
            active: location.pathname === "/wishlist",
            count: cart.wishlist.length,
        },
        {
            to: "/cart",
            label: t("common.cart"),
            icon: ShoppingBag,
            active: location.pathname === "/cart",
            count: cart.items.length,
        },
        {
            to: accountPath,
            label: t("common.account"),
            icon: UserRound,
            active:
                location.pathname === "/account" ||
                location.pathname.startsWith("/account/"),
        },
    ];

    const shareStore = async () => {
        const url = window.location.href;
        const title = company?.name ?? "Online pharmacy";

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
        <div className="min-h-screen bg-background pb-20 text-foreground md:pb-0">
            <header className="sticky top-0 z-40 bg-background/[0.95] shadow-[0_1px_0_rgba(15,23,42,.07)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/88 dark:shadow-[0_1px_0_rgba(255,255,255,.055)]">
                <div className="hidden bg-[var(--brand-surface-strong)] text-white sm:block">
                    <div className="mx-auto flex h-8 w-full max-w-[1380px] items-center justify-between gap-4 px-4 text-[11px] sm:px-6 lg:px-8">
                        <div className="flex min-w-0 items-center gap-2 font-semibold text-white/80">
                            <ShieldCheck className="size-3.5 shrink-0 text-emerald-400" />
                            <span className="truncate">{t("header.secure")}</span>
                        </div>
                        <div className="hidden items-center gap-5 sm:flex">
                            {primaryBranch ? (
                                <span className="flex items-center gap-1.5 text-white/[0.65]">
                                    <MapPin className="size-3.5" />
                                    <span className="max-w-48 truncate">
                                        {primaryBranch.name}
                                    </span>
                                </span>
                            ) : null}
                            {contactPhone ? (
                                <a
                                    href={`tel:${contactPhone}`}
                                    className="flex items-center gap-1.5 text-white/[0.65] transition hover:text-white"
                                >
                                    <Phone className="size-3.5" />
                                    {contactPhone}
                                </a>
                            ) : null}
                        </div>
                    </div>
                </div>

                <div className="bg-background/[0.95]">
                    <div className="mx-auto flex min-h-[64px] w-full max-w-[1380px] items-center gap-3 px-4 py-2 sm:px-6 lg:gap-5 lg:px-8">
                        <Logo />

                        <GlobalSearch className="mx-auto hidden max-w-2xl min-w-0 flex-1 md:block" />

                        <div className="ms-auto flex shrink-0 items-center gap-1">
                            <HeaderAction
                                to={accountPath}
                                icon={<UserRound />}
                                label={auth.user?.fullName ?? t("common.account")}
                                detail={t("header.signInRegister")}
                                className="hidden xl:flex"
                            />
                            <HeaderAction
                                to="/wishlist"
                                icon={<Heart />}
                                label={t("common.wishlist")}
                                detail={t("header.savedItems")}
                                count={cart.wishlist.length}
                                className="hidden xl:flex"
                            />
                            <HeaderAction
                                to="/cart"
                                icon={<ShoppingBag />}
                                label={t("common.cart")}
                                detail={
                                    cartSubtotal > 0
                                        ? formatMoney(cartSubtotal)
                                        : t("header.cartEmpty")
                                }
                                count={cart.items.length}
                                className="hidden lg:flex"
                            />

                            <div className="hidden items-center gap-0.5 border-s border-border/70 ps-2 sm:flex">
                                <LanguageSwitcher />
                                <ThemeToggle />
                                <NotificationCenter />
                            </div>

                            <div className="sm:hidden [&_button]:size-9 [&_button]:rounded-lg [&_svg]:size-4.5">
                                <ThemeToggle />
                            </div>

                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="hidden rounded-lg text-muted-foreground hover:text-primary sm:inline-flex lg:hidden"
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
                                className="relative rounded-lg text-muted-foreground hover:text-primary lg:hidden"
                            >
                                <Link
                                    viewTransition
                                    to="/cart"
                                    aria-label={t("common.cart")}
                                >
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
                                className="rounded-lg md:hidden"
                                onClick={() => setMobileOpen(true)}
                                aria-label={t("mobile.openMenu")}
                            >
                                <Menu className="size-5" />
                            </Button>
                        </div>
                    </div>

                    <div className="mx-auto w-full max-w-[1380px] px-4 pb-2.5 md:hidden sm:px-6">
                        <GlobalSearch compact />
                    </div>
                </div>

                <div className="hidden bg-background md:block">
                    <div className="mx-auto flex min-h-11 w-full max-w-[1380px] items-center gap-3 px-6 pb-2 pt-1 lg:px-8">
                        <CategoryMegaMenu />

                        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
                            {nav.map((item) => {
                                const active = isStoreNavItemActive(
                                    item,
                                    location.pathname,
                                    location.search,
                                );

                                return (
                                    <Link
                                        viewTransition
                                        key={item.to}
                                        to={item.to}
                                        className={cn(
                                            "relative shrink-0 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground",
                                            active &&
                                                "bg-muted text-foreground after:absolute after:inset-x-3 after:-bottom-[6px] after:h-0.5 after:rounded-full after:bg-primary",
                                        )}
                                    >
                                        {t(item.label)}
                                    </Link>
                                );
                            })}

                            {roots.slice(0, 5).map((category) => (
                                <Link
                                    viewTransition
                                    key={category.id}
                                    to={`/products?categoryId=${category.id}`}
                                    className="hidden min-w-0 truncate rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground 2xl:inline-flex"
                                >
                                    {category.name}
                                </Link>
                            ))}
                        </nav>

                        <div className="ms-auto hidden shrink-0 items-center gap-2 xl:flex">
                            <PwaInstallButton compact />
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="rounded-lg text-xs text-muted-foreground"
                                onClick={() => void shareStore()}
                            >
                                {shareConfirmed ? (
                                    <Check className="size-4 text-emerald-600" />
                                ) : (
                                    <Share2 className="size-4" />
                                )}
                                {shareConfirmed
                                    ? t("common.linkCopied")
                                    : t("common.shareStore")}
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            <main>
                <StoreVisitTracker />
                <Outlet />
            </main>

            <footer
                className={cn(
                    "bg-card",
                    location.pathname === "/" ? "mt-0" : "mt-20",
                )}
            >
                <FooterTrustStrip />
                <div className="mx-auto grid w-full max-w-[1380px] gap-8 px-4 py-9 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.2fr_.72fr_.72fr_1.15fr] lg:px-8">
                    <div>
                        <Logo />
                        <p className="mt-5 max-w-md text-sm leading-7 text-muted-foreground">
                            {company?.legalName ??
                                company?.name ??
                                t("footer.onlineStore")}
                        </p>

                        {(company?.branches ?? []).length ? (
                            <div className="mt-5 flex flex-wrap gap-2">
                                {(company?.branches ?? [])
                                    .filter((branch) => branch.isActive)
                                    .slice(0, 4)
                                    .map((branch) => (
                                        <span
                                            key={branch.id}
                                            className="inline-flex items-center gap-1.5 rounded-full bg-muted/[0.55] px-3 py-1.5 text-[11px] font-semibold text-muted-foreground dark:bg-white/[0.04]"
                                        >
                                            <Store className="size-3.5 text-primary" />
                                            {branch.name}
                                        </span>
                                    ))}
                            </div>
                        ) : null}
                    </div>

                    <FooterColumn title={t("nav.shop")}>
                        <FooterLink to="/products">
                            {t("catalog.allCategories")}
                        </FooterLink>
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
                        <FooterLink to={accountPath}>
                            {t("common.account")}
                        </FooterLink>
                        <FooterLink to="/track-order">
                            {t("nav.trackOrder")}
                        </FooterLink>
                        <FooterLink to="/wishlist">
                            {t("common.wishlist")}
                        </FooterLink>
                        <FooterLink to="/cart">{t("common.cart")}</FooterLink>
                    </FooterColumn>

                    <FooterColumn title={t("footer.contactSupport")}>
                        <div className="grid gap-2">
                            {company?.email ? (
                                <FooterContact
                                    icon={<Mail />}
                                    text={company.email}
                                    href={`mailto:${company.email}`}
                                />
                            ) : null}
                            {contactPhone ? (
                                <FooterContact
                                    icon={<Phone />}
                                    text={contactPhone}
                                    href={`tel:${contactPhone}`}
                                />
                            ) : null}
                            {contactAddress ? (
                                <FooterContact
                                    icon={<MapPin />}
                                    text={contactAddress}
                                />
                            ) : null}
                            {!company?.email && !contactPhone && !contactAddress ? (
                                <p className="text-sm leading-6 text-muted-foreground">
                                    {t("home.supportDescription")}
                                </p>
                            ) : null}
                        </div>
                    </FooterColumn>
                </div>

                <div className="bg-muted/[0.22] dark:bg-white/[0.018]">
                    <div className="mx-auto flex w-full max-w-[1380px] flex-col gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
                        <span>
                            © {new Date().getFullYear()}{" "}
                            {company?.legalName ?? company?.name ?? "Default Company"}
                        </span>
                        <span>{t("header.secure")}</span>
                    </div>
                </div>
            </footer>

            {contactPhone ? (
                <a
                    href={`tel:${contactPhone}`}
                    className="fixed bottom-20 end-4 z-30 inline-flex size-11 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-xl shadow-primary/25 ring-1 ring-black/[0.06] transition hover:-translate-y-0.5 md:bottom-5 md:end-5 md:h-auto md:w-auto md:gap-2 md:px-3.5 md:py-2.5 dark:ring-white/[0.08]"
                    aria-label={t("footer.contactNow")}
                >
                    <Phone className="size-4" />
                    <span className="hidden md:inline">
                        {t("footer.contactNow")}
                    </span>
                </a>
            ) : null}

            <nav
                className="fixed inset-x-0 bottom-0 z-40 bg-background/[0.96] shadow-[0_-14px_36px_-30px_rgba(15,23,42,.55)] ring-1 ring-black/[0.06] backdrop-blur-xl md:hidden dark:ring-white/[0.06]"
                style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
                aria-label={t("mobile.mainMenu")}
            >
                <div className="grid h-16 grid-cols-5 px-1.5">
                    {mobileNav.map((item) => {
                        const Icon = item.icon;
                        return (
                            <Link
                                viewTransition
                                key={item.to}
                                to={item.to}
                                className={cn(
                                    "relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold text-muted-foreground transition",
                                    item.active && "text-primary",
                                )}
                            >
                                <span
                                    className={cn(
                                        "relative grid size-7 place-items-center rounded-lg transition",
                                        item.active && "bg-primary/10",
                                    )}
                                >
                                    <Icon className="size-4" />
                                    {item.count ? (
                                        <CountBadge>{item.count}</CountBadge>
                                    ) : null}
                                </span>
                                <span className="max-w-full truncate px-1">
                                    {item.label}
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </nav>

            <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm" />
                    <Dialog.Content className="fixed inset-y-0 end-0 z-50 w-[92%] max-w-sm overflow-y-auto bg-background p-4 shadow-2xl ring-1 ring-black/[0.08] outline-none dark:ring-white/[0.08]">
                        <div className="flex items-center justify-between">
                            <Logo />
                            <Dialog.Close asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="rounded-lg"
                                >
                                    <X className="size-5" />
                                </Button>
                            </Dialog.Close>
                        </div>

                        <GlobalSearch
                            compact
                            className="mt-5"
                            onNavigate={() => setMobileOpen(false)}
                        />

                        <nav className="mt-5 grid gap-1">
                            {nav.map((item) => (
                                <Link
                                    viewTransition
                                    key={item.to}
                                    to={item.to}
                                    onClick={() => setMobileOpen(false)}
                                    className="rounded-lg px-3 py-2.5 text-sm font-bold transition hover:bg-muted hover:text-primary"
                                >
                                    {t(item.label)}
                                </Link>
                            ))}
                        </nav>

                        <div className="my-4 h-px bg-border" />
                        <MobileCategoryLinks
                            onNavigate={() => setMobileOpen(false)}
                        />
                        <div className="my-4 h-px bg-border" />

                        <div className="grid grid-cols-2 gap-2">
                            <Button asChild variant="outline">
                                <Link
                                    viewTransition
                                    to={accountPath}
                                    onClick={() => setMobileOpen(false)}
                                >
                                    <UserRound className="size-4" />
                                    {t("common.account")}
                                </Link>
                            </Button>
                            <Button asChild variant="outline">
                                <Link
                                    viewTransition
                                    to="/wishlist"
                                    onClick={() => setMobileOpen(false)}
                                >
                                    <Heart className="size-4" />
                                    {t("common.wishlist")}
                                </Link>
                            </Button>
                        </div>

                        <div className="mt-3 flex items-center justify-between rounded-lg bg-muted/35 p-1.5 dark:bg-white/[0.035]">
                            <LanguageSwitcher />
                            <ThemeToggle />
                            <NotificationCenter />
                            <PwaInstallButton compact />
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </div>
    );
}


function FooterTrustStrip() {
    const { t } = useI18n();

    return (
        <section className="bg-muted/[0.42] dark:bg-white/[0.025]">
            <div className="mx-auto grid w-full max-w-[1380px] gap-3 px-4 py-3 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
                {footerTrustItems.map((item) => {
                    const Icon = item.icon;
                    return (
                        <div
                            key={item.title}
                            className="flex min-w-0 items-center gap-3 rounded-xl bg-background/80 p-3 shadow-[0_14px_34px_-32px_rgba(15,23,42,.45)] dark:bg-white/[0.035]"
                        >
                            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                                <Icon className="size-4.5" />
                            </span>
                            <span className="min-w-0">
                                <span className="block truncate text-sm font-black text-foreground">
                                    {t(item.title)}
                                </span>
                                <span className="mt-1 block truncate text-xs text-muted-foreground">
                                    {t(item.description)}
                                </span>
                            </span>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

function HeaderAction({
    to,
    icon,
    label,
    detail,
    count,
    className,
}: {
    to: string;
    icon: ReactNode;
    label: string;
    detail: string;
    count?: number;
    className?: string;
}) {
    return (
        <Link
            viewTransition
            to={to}
            className={cn(
                "group relative items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-muted",
                className,
            )}
        >
            <span className="relative grid size-9 shrink-0 place-items-center text-muted-foreground transition group-hover:text-primary [&>svg]:size-5">
                {icon}
                {count ? <CountBadge>{count}</CountBadge> : null}
            </span>
            <span className="min-w-0 max-w-28">
                <span className="block truncate text-xs font-bold text-foreground">
                    {label}
                </span>
                <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                    {detail}
                </span>
            </span>
        </Link>
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
            <h3 className="text-sm font-black uppercase tracking-[0.12em] text-foreground">
                {title}
            </h3>
            <div className="mt-5 grid gap-3 text-sm text-muted-foreground">
                {children}
            </div>
        </div>
    );
}

function FooterLink({ to, children }: { to: string; children: ReactNode }) {
    return (
        <Link
            viewTransition
            to={to}
            className="transition hover:text-primary"
        >
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
        <span className="flex items-start gap-3 rounded-xl bg-muted/[0.42] p-3 transition hover:bg-muted/[0.62] dark:bg-white/[0.03] dark:hover:bg-white/[0.05]">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary [&>svg]:size-4">
                {icon}
            </span>
            <span className="min-w-0 break-words pt-1 text-sm leading-6 text-foreground">
                {text}
            </span>
        </span>
    );

    return href ? (
        <a href={href} className="block">
            {content}
        </a>
    ) : (
        content
    );
}
