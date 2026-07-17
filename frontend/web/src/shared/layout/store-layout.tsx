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
import { ThemeToggle } from "../components/theme-toggle";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";
import {
  CategoryMegaMenu,
  MobileCategoryLinks,
} from "../../features/catalog/category-menu";
const nav = [
  { to: "/", label: "Home" },
  { to: "/products", label: "Shop" },
  { to: "/?section=categories#categories", label: "Categories" },
  { to: "/?section=deals#deals", label: "Deals" },
];
function Logo() {
  return (
    <Link
      to="/"
      className="group flex items-center gap-2.5 font-black tracking-tight"
    >
      <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-blue-400 text-xs text-white shadow-lg shadow-primary/20 transition group-hover:-rotate-6">
        EA
      </span>
      <span className="text-xl">
        Easy<span className="text-brand-orange">Cart</span>
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
    navigate(`/products${query ? `?search=${encodeURIComponent(query)}` : ""}`);
  };
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-background">
        <div className="bg-primary text-primary-foreground">
          <div className="mx-auto flex h-8 w-full max-w-[1500px] items-center justify-between px-4 text-[11px] sm:px-6 lg:px-8">
            <span>Welcome to EasyCart marketplace</span>
            <div className="hidden items-center gap-5 sm:flex">
              <a
                href="mailto:support@easycart.com"
                className="flex items-center gap-1.5"
              >
                <CircleHelp className="size-3" /> Help center
              </a>
              <span>Secure shopping</span>
            </div>
          </div>
        </div>
        <div className="border-b">
          <div className="mx-auto flex h-20 w-full max-w-[1500px] items-center gap-6 px-4 sm:px-6 lg:px-8">
            <Logo />
            <form
              onSubmit={submit}
            className="mx-auto hidden h-11 w-full max-w-2xl items-center rounded-full border bg-background transition focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/20 md:flex"
            >
              <Search className="ml-4 size-4 text-muted-foreground" />
              <input
                className="h-full min-w-0 flex-1 bg-transparent px-4 text-sm"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for products..."
              />
              <Button className="mr-1 h-9 rounded-full px-5">Search</Button>
            </form>
            <div className="ml-auto flex items-center">
              <ThemeToggle />
              <Button variant="ghost" size="icon" aria-label="Account">
                <UserRound />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Wishlist"
                className="relative"
              >
                <Heart />
                <Count value={cart.wishlist.length} />
              </Button>
              <Button asChild variant="ghost" size="icon" className="relative">
                <Link to="/cart" aria-label="Cart">
                  <ShoppingBag />
                  <Count value={cart.count} />
                </Link>
              </Button>
              <Dialog.Root open={open} onOpenChange={setOpen}>
                <Dialog.Trigger asChild>
                  <Button className="lg:hidden" variant="ghost" size="icon">
                    <Menu />
                  </Button>
                </Dialog.Trigger>
                <Dialog.Portal>
                  <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
                  <Dialog.Content className="fixed inset-y-0 right-0 z-50 w-[86%] max-w-sm border-l bg-background p-6 shadow-2xl">
                    <div className="flex justify-between">
                      <Logo />
                      <Dialog.Close asChild>
                        <Button variant="ghost" size="icon">
                          <X />
                        </Button>
                      </Dialog.Close>
                    </div>
                    <form
                      onSubmit={submit}
                      className="mt-8 flex rounded-xl bg-muted"
                    >
                      <input
                        className="h-12 min-w-0 flex-1 bg-transparent px-4"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search products"
                      />
                      <Search className="m-4 size-4" />
                    </form>
                    <nav className="mt-6 grid gap-1">
                      {nav.map((x) => (
                        <NavLink
                          onClick={() => setOpen(false)}
                          key={x.label}
                          to={x.to}
                          className="rounded-lg px-4 py-3 font-semibold hover:bg-muted"
                        >
                          {x.label}
                        </NavLink>
                      ))}
                    </nav>
                    <MobileCategoryLinks onNavigate={() => setOpen(false)} />
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>
            </div>
          </div>
        </div>
        <div className="hidden border-b lg:block">
          <div className="mx-auto flex h-12 w-full max-w-[1500px] items-center px-8">
            <CategoryMegaMenu />
            <nav className="flex items-center gap-1">
              {nav.map((x) => (
                <NavLink
                  key={x.label}
                  end={x.to === "/"}
                  to={x.to}
                  className={({ isActive }) =>
                    cn(
                      "px-4 py-3 text-sm font-semibold text-muted-foreground hover:text-primary",
                      isActive && "text-primary",
                    )
                  }
                >
                  {x.label}
                </NavLink>
              ))}
            </nav>
            <Link
              to="/products?isFeatured=true"
              className="ml-auto text-sm font-bold text-brand-orange"
            >
              Featured products
            </Link>
          </div>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="mt-16 bg-[#071526] text-slate-300">
        <div className="mx-auto grid w-full max-w-[1500px] gap-10 px-4 py-14 sm:px-6 md:grid-cols-4 lg:px-8">
          <div className="md:col-span-2">
            <Logo />
            <p className="mt-5 max-w-md text-sm leading-7 text-slate-400">
              Products you can trust, availability you can see, and a shopping
              experience designed to feel effortless.
            </p>
          </div>
          <FooterGroup
            title="Shop"
            links={["All products", "New arrivals", "Categories"]}
          />
          <FooterGroup
            title="Customer care"
            links={["Contact support", "Delivery & returns", "Privacy policy"]}
          />
        </div>
        <div className="border-t border-white/10 py-5 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} EasyCart. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
function Count({ value }: { value: number }) {
  return (
    <span className="absolute right-0 top-0 grid size-4 place-items-center rounded-full bg-brand-orange text-[9px] text-white">
      {value}
    </span>
  );
}
function FooterGroup({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <h3 className="mb-4 font-bold text-white">{title}</h3>
      <div className="grid gap-3 text-sm">
        {links.map((x) => (
          <span key={x}>{x}</span>
        ))}
      </div>
    </div>
  );
}
