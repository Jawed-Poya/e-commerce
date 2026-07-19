import { useQuery } from "@tanstack/react-query";
import {
    ArrowRight,
    BadgeCheck,
    CalendarDays,
    LogOut,
    PackageSearch,
    ReceiptText,
    UserRound,
} from "lucide-react";
import { Link, Navigate } from "react-router-dom";

import { Button } from "../../shared/components/ui/button";
import { formatMoney } from "../../shared/lib/money";
import { useAuth } from "../auth/auth-context";
import { getAccountOrders } from "./account-api";

export function AccountPage() {
    const auth = useAuth();
    const orders = useQuery({
        queryKey: ["account-orders", auth.user?.customerId],
        queryFn: getAccountOrders,
        enabled: auth.isAuthenticated,
    });

    if (!auth.loading && !auth.isAuthenticated) {
        return <Navigate to="/account/login" replace state={{ from: "/account" }} />;
    }

    const user = auth.user;
    if (!user) return null;

    return (
        <main className="mx-auto w-full max-w-[1300px] px-4 py-8 sm:px-6 lg:px-8 lg:py-14">
            <section className="overflow-hidden rounded-[32px] border bg-card shadow-[0_22px_70px_rgba(15,23,42,0.07)]">
                <div className="relative overflow-hidden border-b bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-7 sm:p-10">
                    <div className="absolute -right-16 -top-20 size-72 rounded-full bg-blue-500/10 blur-3xl" />
                    <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-4">
                            <span className="grid size-16 place-items-center rounded-2xl bg-primary text-xl font-black text-primary-foreground shadow-lg shadow-primary/20">
                                {user.fullName.slice(0, 2).toUpperCase()}
                            </span>
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Customer account</p>
                                <h1 className="mt-1 text-3xl font-black tracking-[-0.04em]">{user.fullName}</h1>
                                <p className="mt-1 text-sm text-muted-foreground">{user.email ?? user.phone}</p>
                            </div>
                        </div>
                        <Button variant="outline" onClick={auth.logout} className="rounded-xl"><LogOut /> Sign out</Button>
                    </div>
                </div>

                <div className="grid gap-4 p-6 sm:grid-cols-3 sm:p-8">
                    <ProfileCard icon={<BadgeCheck />} label="Customer type" value={user.customerTypeName ?? "General"} description="This type determines your product pricing." />
                    <ProfileCard icon={<UserRound />} label="Phone" value={user.phone ?? "Not set"} description="Used to identify and track guest orders." />
                    <ProfileCard icon={<ReceiptText />} label="Orders" value={String(orders.data?.length ?? 0)} description="Orders connected to this customer account." />
                </div>
            </section>

            <section className="mt-8">
                <div className="flex items-end justify-between gap-4">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Order history</p>
                        <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Your order numbers</h2>
                        <p className="mt-2 text-sm text-muted-foreground">You no longer need to remember or manually save order numbers.</p>
                    </div>
                    <Button asChild variant="outline" className="hidden rounded-xl sm:flex"><Link to="/track-order"><PackageSearch /> Guest tracking</Link></Button>
                </div>

                <div className="mt-6 grid gap-4">
                    {orders.isLoading && <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">Loading your orders...</div>}
                    {orders.isError && <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center text-destructive">Your orders could not be loaded.</div>}
                    {orders.data?.map((order) => (
                        <article key={order.id} className="grid gap-5 rounded-2xl border bg-card p-5 transition hover:border-primary/30 hover:shadow-md sm:grid-cols-[1fr_auto] sm:items-center">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="break-all text-lg font-black text-primary">{order.orderNumber}</h3>
                                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">{order.status}</span>
                                    <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground">{order.paymentStatus}</span>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1.5"><CalendarDays className="size-3.5" />{new Date(order.createdAt).toLocaleString()}</span>
                                    <span>{order.itemCount} item{order.itemCount === 1 ? "" : "s"}</span>
                                    <span>{order.paymentMethod}</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between gap-4 sm:justify-end">
                                <p className="text-xl font-black">{formatMoney(order.total, order.currency)}</p>
                                <Button asChild variant="outline" size="icon" className="rounded-xl"><Link to={`/track-order?orderNumber=${encodeURIComponent(order.orderNumber)}&phone=${encodeURIComponent(order.customerPhone)}`} aria-label={`Track ${order.orderNumber}`}><ArrowRight /></Link></Button>
                            </div>
                        </article>
                    ))}
                    {!orders.isLoading && orders.data?.length === 0 && (
                        <div className="rounded-3xl border border-dashed bg-card p-10 text-center">
                            <PackageSearch className="mx-auto size-10 text-muted-foreground" />
                            <h3 className="mt-4 text-xl font-black">No orders yet</h3>
                            <p className="mt-2 text-sm text-muted-foreground">Your next checkout will appear here automatically.</p>
                            <Button asChild className="mt-5 rounded-xl"><Link to="/products">Start shopping</Link></Button>
                        </div>
                    )}
                </div>
            </section>
        </main>
    );
}

function ProfileCard({ icon, label, value, description }: { icon: React.ReactNode; label: string; value: string; description: string }) {
    return <div className="rounded-2xl border bg-background p-5"><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary [&_svg]:size-5">{icon}</span><p className="mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-xl font-black">{value}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p></div>;
}
