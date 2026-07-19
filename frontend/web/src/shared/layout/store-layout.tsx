import * as Dialog from "@radix-ui/react-dialog";
import {
    CircleHelp,
    Heart,
    Menu,
    Search,
    ShoppingBag,
    UserRound,
    X,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";

import { useCart } from "../../features/cart/cart-context";
import {
    CategoryMegaMenu,
    MobileCategoryLinks,
} from "../../features/catalog/category-menu";

import { ThemeToggle } from "../components/theme-toggle";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";

const nav = [
    { to: "/", label: "Home" },
    { to: "/products", label: "Shop" },
    { to: "/?section=categories#categories", label: "Categories" },
    { to: "/?section=deals#deals", label: "Deals" },
    { to: "/track-order", label: "Track order" },
];

function Logo() {
    return (
        <Link
            to="/"
            className="group flex shrink-0 items-center gap-2.5 font-black tracking-tight"
        >
            <span className="relative grid size-10 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-blue-500 text-xs text-white shadow-lg shadow-primary/20 transition-all duration-300 group-hover:-rotate-3 group-hover:scale-105">
                <span className="relative z-10">EA</span>

                <span className="absolute -right-2 -top-2 size-6 rounded-full bg-white/20" />
                <span className="absolute -bottom-3 -left-3 size-8 rounded-full bg-blue-300/20" />
            </span>

            <span className="text-xl tracking-[-0.04em] text-foreground">
                Easy
                <span className="text-brand-orange">Cart</span>
            </span>
        </Link>
    );
}

export function StoreLayout() {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);

    const navigate = useNavigate();
    const cart = useCart();

    const submit = (e: FormEvent) => {
        e.preventDefault();

        navigate(
            `/products${query ? `?search=${encodeURIComponent(query)}` : ""}`,
        );
    };

    return (
        <div className="min-h-screen bg-background text-foreground">
            <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 shadow-[0_1px_16px_rgba(15,23,42,0.04)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 dark:shadow-[0_1px_20px_rgba(0,0,0,0.25)]">
                {/* Top announcement bar */}
                <div className="border-b border-border/60 bg-primary/[0.04] text-foreground dark:border-white/10 dark:bg-slate-950 dark:text-slate-200">
                    <div className="mx-auto flex h-9 w-full max-w-[1500px] items-center justify-between gap-4 px-4 text-[11px] sm:px-6 lg:px-8">
                        <div className="flex min-w-0 items-center gap-2">
                            <span className="relative flex size-2 shrink-0">
                                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60 dark:bg-emerald-400" />
                                <span className="relative inline-flex size-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                            </span>

                            <span className="truncate font-medium">
                                Welcome to EasyCart marketplace
                            </span>
                        </div>

                        <div className="hidden items-center gap-5 sm:flex">
                            <a
                                href="mailto:support@easycart.com"
                                className="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-primary dark:text-slate-300 dark:hover:text-white"
                            >
                                <CircleHelp className="size-3.5" />
                                Help center
                            </a>

                            <span className="text-muted-foreground dark:text-slate-400">
                                Secure and trusted shopping
                            </span>
                        </div>
                    </div>
                </div>

                {/* Main header */}
                <div className="border-b border-border/70 bg-background/95">
                    <div className="mx-auto flex h-[70px] w-full max-w-[1500px] items-center gap-2.5 px-4 sm:h-[76px] sm:px-6 md:gap-6 lg:h-20 lg:px-8">
                        <Logo />

                        <form
                            onSubmit={submit}
                            className="group mx-auto hidden h-12 w-full max-w-2xl items-center rounded-2xl border border-input bg-muted/35 p-1 transition-all duration-200 focus-within:border-primary/60 focus-within:bg-background focus-within:shadow-sm focus-within:ring-4 focus-within:ring-primary/10 md:flex"
                        >
                            <Search className="ml-3 size-5 shrink-0 text-muted-foreground transition-colors group-focus-within:text-primary" />

                            <input
                                className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search products, brands and categories..."
                            />

                            <Button className="h-10 rounded-xl px-6 font-semibold shadow-sm">
                                Search
                            </Button>
                        </form>

                        <div className="ml-auto flex items-center gap-0.5">
                            <ThemeToggle />

                            <Button
                                asChild
                                variant="ghost"
                                size="icon"
                                className="hidden rounded-xl text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary sm:inline-flex"
                            >
                                <Link to="/track-order" aria-label="Track order">
                                    <UserRound className="size-5" />
                                </Link>
                            </Button>

                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Wishlist"
                                className="relative hidden rounded-xl text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary sm:inline-flex"
                            >
                                <Heart className="size-5" />
                                <Count value={cart.wishlist.length} />
                            </Button>

                            <Button
                                asChild
                                variant="ghost"
                                size="icon"
                                className="relative rounded-xl text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                            >
                                <Link to="/cart" aria-label="Cart">
                                    <ShoppingBag className="size-5" />
                                    <Count value={cart.count} />
                                </Link>
                            </Button>

                            <Dialog.Root open={open} onOpenChange={setOpen}>
                                <Dialog.Trigger asChild>
                                    <Button
                                        className="rounded-xl lg:hidden"
                                        variant="ghost"
                                        size="icon"
                                        aria-label="Open menu"
                                    >
                                        <Menu className="size-5" />
                                    </Button>
                                </Dialog.Trigger>

                                <Dialog.Portal>
                                    <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-sm data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out data-[state=open]:fade-in" />

                                    <Dialog.Content className="fixed inset-y-0 right-0 z-50 w-[90%] max-w-sm overflow-y-auto border-l bg-background shadow-2xl outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right">
                                        <div className="flex min-h-full flex-col">
                                            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/95 px-5 py-4 backdrop-blur-xl">
                                                <Logo />

                                                <Dialog.Close asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="rounded-xl"
                                                        aria-label="Close menu"
                                                    >
                                                        <X className="size-5" />
                                                    </Button>
                                                </Dialog.Close>
                                            </div>

                                            <div className="px-5 py-5">
                                                <form
                                                    onSubmit={submit}
                                                    className="flex h-12 items-center rounded-2xl border bg-muted/40 px-1 transition-all focus-within:border-primary/60 focus-within:bg-background focus-within:ring-4 focus-within:ring-primary/10"
                                                >
                                                    <Search className="ml-3 size-4 text-muted-foreground" />

                                                    <input
                                                        className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
                                                        value={query}
                                                        onChange={(e) =>
                                                            setQuery(
                                                                e.target.value,
                                                            )
                                                        }
                                                        placeholder="Search products"
                                                    />

                                                    <Button
                                                        type="submit"
                                                        size="sm"
                                                        className="rounded-xl px-4"
                                                    >
                                                        Search
                                                    </Button>
                                                </form>
                                            </div>

                                            <div className="grid grid-cols-3 gap-2 px-5 pb-5">
                                                <MobileAction
                                                    icon={
                                                        <UserRound className="size-5" />
                                                    }
                                                    label="Account"
                                                />

                                                <MobileAction
                                                    icon={
                                                        <Heart className="size-5" />
                                                    }
                                                    label="Wishlist"
                                                    count={cart.wishlist.length}
                                                />

                                                <Link
                                                    to="/cart"
                                                    onClick={() =>
                                                        setOpen(false)
                                                    }
                                                    className="relative flex flex-col items-center gap-2 rounded-2xl border bg-card px-2 py-4 text-xs font-semibold shadow-sm transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                                                >
                                                    <span className="relative">
                                                        <ShoppingBag className="size-5" />
                                                        <Count
                                                            value={cart.count}
                                                        />
                                                    </span>
                                                    Cart
                                                </Link>
                                            </div>

                                            <div className="border-y bg-muted/15 px-5 py-5">
                                                <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                                                    Main menu
                                                </p>

                                                <nav className="grid gap-1">
                                                    {nav.map((x) => (
                                                        <NavLink
                                                            onClick={() =>
                                                                setOpen(false)
                                                            }
                                                            key={x.label}
                                                            to={x.to}
                                                            className={({
                                                                isActive,
                                                            }) =>
                                                                cn(
                                                                    "flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold text-muted-foreground transition-all hover:bg-background hover:text-foreground",
                                                                    isActive &&
                                                                        "bg-primary/10 text-primary shadow-sm hover:bg-primary/10 hover:text-primary",
                                                                )
                                                            }
                                                        >
                                                            {x.label}

                                                            <span className="text-lg font-light opacity-40">
                                                                ›
                                                            </span>
                                                        </NavLink>
                                                    ))}
                                                </nav>
                                            </div>

                                            <div className="px-5 py-5">
                                                <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                                                    Shop by category
                                                </p>

                                                <MobileCategoryLinks
                                                    onNavigate={() =>
                                                        setOpen(false)
                                                    }
                                                />
                                            </div>

                                            <div className="mt-auto border-t bg-muted/25 p-5">
                                                <div className="rounded-2xl border bg-card p-4 shadow-sm">
                                                    <div className="flex gap-3">
                                                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                                                            <CircleHelp className="size-5" />
                                                        </span>

                                                        <div>
                                                            <p className="text-sm font-bold">
                                                                Need shopping
                                                                help?
                                                            </p>

                                                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                                                Contact our
                                                                support team for
                                                                product and
                                                                order
                                                                assistance.
                                                            </p>

                                                            <a
                                                                href="mailto:support@easycart.com"
                                                                className="mt-2 inline-block text-xs font-bold text-primary"
                                                            >
                                                                support@easycart.com
                                                            </a>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </Dialog.Content>
                                </Dialog.Portal>
                            </Dialog.Root>
                        </div>
                    </div>

                    {/* Mobile search */}
                    <div className="mx-auto w-full max-w-[1500px] px-4 pb-3 md:hidden">
                        <form
                            onSubmit={submit}
                            className="flex h-11 items-center rounded-2xl border bg-muted/35 px-1 transition-all focus-within:border-primary/60 focus-within:bg-background focus-within:ring-4 focus-within:ring-primary/10"
                        >
                            <Search className="ml-3 size-4 text-muted-foreground" />

                            <input
                                className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search products..."
                            />

                            <Button
                                type="submit"
                                size="sm"
                                className="h-9 rounded-xl px-4"
                            >
                                Search
                            </Button>
                        </form>
                    </div>
                </div>

                {/* Desktop category/navigation bar */}
                <div className="hidden bg-background lg:block">
                    <div className="mx-auto flex h-[52px] w-full max-w-[1500px] items-center px-8">
                        <CategoryMegaMenu />

                        <div className="mx-4 h-6 w-px bg-border" />

                        <nav className="flex h-full items-center gap-1">
                            {nav.map((x) => (
                                <NavLink
                                    key={x.label}
                                    end={x.to === "/"}
                                    to={x.to}
                                    className={({ isActive }) =>
                                        cn(
                                            "relative flex h-full items-center rounded-lg px-4 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted/40 hover:text-primary",
                                            isActive && "text-primary",
                                        )
                                    }
                                >
                                    {({ isActive }) => (
                                        <>
                                            {x.label}

                                            <span
                                                className={cn(
                                                    "absolute inset-x-4 bottom-0 h-0.5 origin-center scale-x-0 rounded-full bg-primary transition-transform duration-200",
                                                    isActive && "scale-x-100",
                                                )}
                                            />
                                        </>
                                    )}
                                </NavLink>
                            ))}
                        </nav>

                        <Link
                            to="/products?isFeatured=true"
                            className="group ml-auto flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-brand-orange transition-colors hover:bg-brand-orange/10"
                        >
                            <span className="relative flex size-2">
                                <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-orange opacity-60" />
                                <span className="relative inline-flex size-2 rounded-full bg-brand-orange" />
                            </span>
                            Featured products
                            <span className="transition-transform group-hover:translate-x-1">
                                →
                            </span>
                        </Link>
                    </div>
                </div>
            </header>

            <main className="min-h-[60vh] bg-gradient-to-b from-muted/15 via-background to-background">
                <Outlet />
            </main>

            {/* Footer */}
            <footer className="relative mt-16 overflow-hidden border-t bg-muted/35 text-muted-foreground dark:border-white/10 dark:bg-[#071526] dark:text-slate-300">
                <div className="pointer-events-none absolute -right-40 -top-40 size-96 rounded-full bg-primary/8 blur-3xl dark:bg-primary/15" />
                <div className="pointer-events-none absolute -bottom-40 -left-40 size-96 rounded-full bg-blue-500/5 blur-3xl dark:bg-blue-500/10" />

                <div className="relative border-b border-border/70 dark:border-white/10">
                    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 px-4 py-9 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
                        <div>
                            <h2 className="text-xl font-black tracking-tight text-foreground dark:text-white sm:text-2xl">
                                Shop smarter with EasyCart
                            </h2>

                            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground dark:text-slate-400">
                                Trusted products, secure shopping and an
                                experience designed to make every order simple.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5 text-xs font-semibold">
                            <span className="rounded-full border bg-background/70 px-4 py-2 text-muted-foreground shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:shadow-none">
                                Secure checkout
                            </span>

                            <span className="rounded-full border bg-background/70 px-4 py-2 text-muted-foreground shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:shadow-none">
                                Fast delivery
                            </span>

                            <span className="rounded-full border bg-background/70 px-4 py-2 text-muted-foreground shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:shadow-none">
                                Easy returns
                            </span>
                        </div>
                    </div>
                </div>

                <div className="relative mx-auto grid w-full max-w-[1500px] gap-10 px-4 py-12 sm:px-6 sm:py-14 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
                    <div className="md:col-span-2">
                        <Logo />

                        <p className="mt-5 max-w-md text-sm leading-7 text-muted-foreground dark:text-slate-400">
                            Products you can trust, availability you can see,
                            and a shopping experience designed to feel
                            effortless.
                        </p>

                        <a
                            href="mailto:support@easycart.com"
                            className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-foreground transition-colors hover:text-primary dark:text-white dark:hover:text-primary"
                        >
                            <CircleHelp className="size-4" />
                            support@easycart.com
                        </a>
                    </div>

                    <FooterGroup
                        title="Shop"
                        links={["All products", "New arrivals", "Categories"]}
                    />

                    <FooterGroup
                        title="Customer care"
                        links={[
                            "Contact support",
                            "Delivery & returns",
                            "Privacy policy",
                        ]}
                    />
                </div>

                <div className="relative border-t border-border/70 dark:border-white/10">
                    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-3 px-4 py-5 text-xs text-muted-foreground sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8 dark:text-slate-500">
                        <span>
                            © {new Date().getFullYear()} EasyCart. All rights
                            reserved.
                        </span>

                        <span>
                            Made for a better online shopping experience.
                        </span>
                    </div>
                </div>
            </footer>
        </div>
    );
}

function Count({ value }: { value: number }) {
    if (value <= 0) {
        return null;
    }

    return (
        <span className="absolute -right-1.5 -top-1.5 grid min-w-4.5 place-items-center rounded-full border-2 border-background bg-brand-orange px-1 text-[9px] font-bold leading-4 text-white shadow-sm">
            {value > 99 ? "99+" : value}
        </span>
    );
}

function MobileAction({
    icon,
    label,
    count,
}: {
    icon: React.ReactNode;
    label: string;
    count?: number;
}) {
    return (
        <button
            type="button"
            className="relative flex flex-col items-center gap-2 rounded-2xl border bg-card px-2 py-4 text-xs font-semibold shadow-sm transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
        >
            <span className="relative">
                {icon}

                {typeof count === "number" && <Count value={count} />}
            </span>

            {label}
        </button>
    );
}

function FooterGroup({ title, links }: { title: string; links: string[] }) {
    return (
        <div>
            <h3 className="mb-5 text-sm font-bold uppercase tracking-[0.15em] text-foreground dark:text-white">
                {title}
            </h3>

            <div className="grid gap-3.5 text-sm">
                {links.map((x) => (
                    <span
                        key={x}
                        className="w-fit cursor-pointer text-muted-foreground transition-colors hover:text-primary dark:text-slate-400 dark:hover:text-white"
                    >
                        {x}
                    </span>
                ))}
            </div>
        </div>
    );
}
