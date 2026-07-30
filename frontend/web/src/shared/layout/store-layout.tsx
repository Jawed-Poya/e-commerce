import * as Dialog from "@radix-ui/react-dialog";
import {
    Check,
    Heart,
    Mail,
    MapPin,
    Menu,
    Phone,
    Share2,
    ShieldCheck,
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
import { formatMoney } from "../lib/money";
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
    const name = company?.name ?? "PharmaDB";
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
            className="group flex min-w-0 shrink-0 items-center gap-3"
        >
            <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-primary/15 bg-primary text-xs font-black text-primary-foreground shadow-sm transition duration-200 group-hover:-translate-y-0.5">
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
        <div className="min-h-screen bg-background text-foreground">
            <header className="sticky top-0 z-40 border-b border-border/70 bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/88">
                <div className="bg-slate-950 text-white dark:bg-black">
                    <div className="mx-auto flex h-9 w-full max-w-[1480px] items-center justify-between gap-4 px-4 text-[11px] sm:px-6 lg:px-8">
                        <div className="flex min-w-0 items-center gap-2 font-semibold text-white/80">
                            <ShieldCheck className="size-3.5 shrink-0 text-emerald-400" />
                            <span className="truncate">{t("header.secure")}</span>
                        </div>
                        <div className="hidden items-center gap-5 sm:flex">
                            {primaryBranch ? (
                                <span className="flex items-center gap-1.5 text-white/65">
                                    <MapPin className="size-3.5" />
                                    <span className="max-w-48 truncate">
                                        {primaryBranch.name}
                                    </span>
                                </span>
                            ) : null}
                            {company?.phone ? (
                                <a
                                    href={`tel:${company.phone}`}
                                    className="flex items-center gap-1.5 text-white/65 transition hover:text-white"
                                >
                                    <Phone className="size-3.5" />
                                    {company.phone}
                                </a>
                            ) : null}
                        </div>
                    </div>
                </div>

                <div className="border-b border-border/70 bg-background/95">
                    <div className="mx-auto flex min-h-[72px] w-full max-w-[1480px] items-center gap-3 px-4 py-3 sm:px-6 lg:gap-5 lg:px-8">
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

                    <div className="mx-auto w-full max-w-[1480px] px-4 pb-3 md:hidden sm:px-6">
                        <GlobalSearch compact />
                    </div>
                </div>

                <div className="hidden bg-background md:block">
                    <div className="mx-auto flex h-12 w-full max-w-[1480px] items-center gap-4 px-6 lg:px-8">
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
                                            "relative shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground",
                                            active &&
                                                "bg-muted text-foreground after:absolute after:inset-x-3 after:-bottom-[7px] after:h-0.5 after:bg-primary",
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
                                    className="hidden min-w-0 truncate rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground 2xl:inline-flex"
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
                <Outlet />
            </main>

            <footer className="mt-20 border-t border-border/70 bg-card">
                <div className="border-b border-border/70 bg-muted/25">
                    <div className="mx-auto grid w-full max-w-[1480px] divide-y divide-border/70 px-4 sm:grid-cols-2 sm:divide-x sm:divide-y-0 sm:px-6 lg:grid-cols-4 lg:px-8 rtl:sm:divide-x-reverse">
                        <FooterPromise
                            title={t("footer.secureCheckout")}
                            description={t("header.secure")}
                        />
                        <FooterPromise
                            title={t("footer.fastDelivery")}
                            description={t("home.deliveryTracking")}
                        />
                        <FooterPromise
                            title={t("footer.easyReturns")}
                            description={t("home.simplePolicy")}
                        />
                        <FooterPromise
                            title={t("footer.contactSupport")}
                            description={
                                company?.phone ??
                                company?.email ??
                                t("footer.customerCare")
                            }
                        />
                    </div>
                </div>

                <div className="mx-auto grid w-full max-w-[1480px] gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.35fr_.75fr_.8fr_1fr] lg:px-8">
                    <div>
                        <Logo />
                        <p className="mt-5 max-w-md text-sm leading-7 text-muted-foreground">
                            {company?.legalName ??
                                company?.name ??
                                t("footer.onlineStore")}
                        </p>
                        <div className="mt-5 grid gap-2 text-sm text-muted-foreground">
                            {company?.address ? (
                                <FooterContact
                                    icon={<MapPin />}
                                    text={company.address}
                                />
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

                    <FooterColumn title={t("footer.locations")}>
                        {(company?.branches ?? []).slice(0, 5).map((branch) => (
                            <div
                                key={branch.id}
                                className="rounded-xl border border-border/70 bg-background p-3"
                            >
                                <p className="flex items-center gap-2 text-sm font-bold text-foreground">
                                    <Store className="size-4 text-primary" />
                                    {branch.name}
                                </p>
                                {branch.address ? (
                                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                        {branch.address}
                                    </p>
                                ) : null}
                            </div>
                        ))}
                    </FooterColumn>
                </div>

                <div className="border-t border-border/70">
                    <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
                        <span>
                            © {new Date().getFullYear()}{" "}
                            {company?.legalName ?? company?.name ?? "PharmaDB"}
                        </span>
                        <span>{t("header.secure")}</span>
                    </div>
                </div>
            </footer>

            {company?.phone ? (
                <a
                    href={`tel:${company.phone}`}
                    className="fixed bottom-5 end-5 z-30 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-xl shadow-primary/25 transition hover:-translate-y-0.5"
                    aria-label={t("footer.contactNow")}
                >
                    <Phone className="size-4" />
                    <span className="hidden sm:inline">
                        {t("footer.contactNow")}
                    </span>
                </a>
            ) : null}

            <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm" />
                    <Dialog.Content className="fixed inset-y-0 end-0 z-50 w-[92%] max-w-sm overflow-y-auto border-s bg-background p-5 shadow-2xl outline-none">
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
                            className="mt-6"
                            onNavigate={() => setMobileOpen(false)}
                        />

                        <nav className="mt-6 grid gap-1">
                            {nav.map((item) => (
                                <Link
                                    viewTransition
                                    key={item.to}
                                    to={item.to}
                                    onClick={() => setMobileOpen(false)}
                                    className="rounded-lg px-4 py-3 text-sm font-bold transition hover:bg-muted hover:text-primary"
                                >
                                    {t(item.label)}
                                </Link>
                            ))}
                        </nav>

                        <div className="my-5 h-px bg-border" />
                        <MobileCategoryLinks
                            onNavigate={() => setMobileOpen(false)}
                        />
                        <div className="my-5 h-px bg-border" />

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

                        <div className="mt-3 flex items-center justify-between rounded-xl border border-border/70 p-2">
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

function FooterPromise({
    title,
    description,
}: {
    title: string;
    description: string;
}) {
    return (
        <div className="flex min-h-24 items-center gap-3 px-5 py-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-primary/15 bg-primary/8 text-primary">
                <Check className="size-4" />
            </span>
            <span className="min-w-0">
                <span className="block text-sm font-bold text-foreground">
                    {title}
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {description}
                </span>
            </span>
        </div>
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
        <span className="flex items-start gap-2">
            <span className="mt-0.5 text-primary [&>svg]:size-4">{icon}</span>
            <span>{text}</span>
        </span>
    );

    return href ? (
        <a href={href} className="transition hover:text-primary">
            {content}
        </a>
    ) : (
        content
    );
}
