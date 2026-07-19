import { ArrowLeft, Home, Search, ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "../components/ui/button";

export function NotFoundPage() {
    return (
        <main className="relative grid min-h-[70vh] place-items-center overflow-hidden px-4 py-16">
            <div className="pointer-events-none absolute left-1/2 top-1/2 size-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />

            <div className="relative mx-auto w-full max-w-2xl text-center">
                <div className="relative mx-auto mb-8 flex size-32 items-center justify-center sm:size-40">
                    <div className="absolute inset-0 rounded-full border border-dashed border-primary/30" />

                    <div className="absolute inset-4 rounded-full bg-primary/10" />

                    <div className="relative grid size-20 place-items-center rounded-3xl bg-background shadow-xl shadow-primary/10 ring-1 ring-border sm:size-24">
                        <ShoppingBag className="size-9 text-primary sm:size-11" />
                    </div>

                    <span className="absolute -right-2 top-2 grid size-12 place-items-center rounded-2xl bg-brand-orange text-sm font-black text-white shadow-lg shadow-brand-orange/20">
                        404
                    </span>
                </div>

                <div className="mb-5 flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-primary">
                    <span className="h-px w-8 bg-primary/30" />
                    Page not found
                    <span className="h-px w-8 bg-primary/30" />
                </div>

                <h1 className="text-balance text-3xl font-black tracking-tight text-foreground sm:text-5xl">
                    We couldn’t find that page.
                </h1>

                <p className="mx-auto mt-5 max-w-xl text-pretty text-sm leading-7 text-muted-foreground sm:text-base">
                    The page may have moved, the link could be incorrect, or the
                    product is no longer available.
                </p>

                <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                    <Button
                        asChild
                        size="lg"
                        className="w-full rounded-xl px-6 sm:w-auto"
                    >
                        <Link to="/">
                            <Home className="size-4" />
                            Back to home
                        </Link>
                    </Button>

                    <Button
                        asChild
                        variant="outline"
                        size="lg"
                        className="w-full rounded-xl px-6 sm:w-auto"
                    >
                        <Link to="/products">
                            <Search className="size-4" />
                            Browse products
                        </Link>
                    </Button>
                </div>

                <Link
                    to="/"
                    className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary"
                >
                    <ArrowLeft className="size-4" />
                    Return to the EasyCart homepage
                </Link>
            </div>
        </main>
    );
}
