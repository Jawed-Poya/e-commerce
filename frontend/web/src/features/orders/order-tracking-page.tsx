import { useQuery } from "@tanstack/react-query";
import {
    Check,
    CircleDashed,
    LoaderCircle,
    PackageSearch,
    Search,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";

import { ApiError } from "../../shared/api/api-client";
import { Button } from "../../shared/components/ui/button";
import { formatMoney } from "../../shared/lib/money";
import { trackOrder } from "./order-api";

export function OrderTrackingPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [orderNumber, setOrderNumber] = useState(
        searchParams.get("orderNumber") ?? "",
    );
    const [phone, setPhone] = useState(searchParams.get("phone") ?? "");
    const submittedOrderNumber = searchParams.get("orderNumber") ?? "";
    const submittedPhone = searchParams.get("phone") ?? "";

    const query = useQuery({
        queryKey: ["track-order", submittedOrderNumber, submittedPhone],
        queryFn: () => trackOrder(submittedOrderNumber, submittedPhone),
        enabled: Boolean(submittedOrderNumber && submittedPhone),
        retry: false,
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        setSearchParams({
            orderNumber: orderNumber.trim(),
            phone: phone.trim(),
        });
    };

    return (
        <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:py-16">
            <div className="text-center">
                <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-primary/10 text-primary">
                    <PackageSearch className="size-8" />
                </span>
                <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-primary">
                    Order tracking
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-5xl">
                    Check your order status
                </h1>
                <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
                    Enter the order number and the same phone number used at
                    checkout.
                </p>
            </div>

            <form
                onSubmit={submit}
                className="mx-auto mt-8 grid max-w-3xl gap-4 rounded-3xl border bg-card p-5 shadow-[0_16px_50px_rgba(15,23,42,0.07)] sm:grid-cols-[1fr_1fr_auto] sm:p-7"
            >
                <TrackingField
                    label="Order number"
                    value={orderNumber}
                    onChange={setOrderNumber}
                    placeholder="ORD-20260719-123456"
                />
                <TrackingField
                    label="Phone number"
                    value={phone}
                    onChange={setPhone}
                    placeholder="+93 ..."
                />
                <Button
                    type="submit"
                    className="h-12 self-end rounded-xl px-6"
                    disabled={!orderNumber.trim() || !phone.trim()}
                >
                    <Search /> Track
                </Button>
            </form>

            {query.isFetching && (
                <div className="mt-10 flex justify-center text-muted-foreground">
                    <LoaderCircle className="mr-2 animate-spin" /> Loading order...
                </div>
            )}

            {query.isError && (
                <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-destructive/20 bg-destructive/5 p-5 text-center text-destructive">
                    {query.error instanceof ApiError
                        ? query.error.message
                        : "The order could not be loaded."}
                </div>
            )}

            {query.data && (
                <section className="mx-auto mt-8 max-w-3xl overflow-hidden rounded-3xl border bg-card shadow-[0_18px_55px_rgba(15,23,42,0.07)]">
                    <div className="flex flex-col gap-4 border-b bg-muted/25 p-6 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Order
                            </p>
                            <h2 className="mt-1 text-2xl font-black text-primary">
                                {query.data.orderNumber}
                            </h2>
                        </div>
                        <div className="sm:text-right">
                            <p className="text-xs text-muted-foreground">
                                Total
                            </p>
                            <p className="text-2xl font-black">
                                {formatMoney(
                                    query.data.total,
                                    query.data.currency,
                                )}
                            </p>
                        </div>
                    </div>

                    <div className="grid gap-3 border-b p-6 sm:grid-cols-3">
                        <StatusCard label="Order" value={query.data.status} />
                        <StatusCard
                            label="Payment"
                            value={query.data.paymentStatus}
                        />
                        <StatusCard
                            label="Fulfillment"
                            value={query.data.fulfillmentStatus}
                        />
                    </div>

                    <div className="p-6">
                        <h3 className="font-black">Timeline</h3>
                        <div className="mt-5 space-y-0">
                            {query.data.timeline.map((item, index) => (
                                <div
                                    key={item.id || `${item.createdAt}-${index}`}
                                    className="relative flex gap-4 pb-7 last:pb-0"
                                >
                                    {index < query.data.timeline.length - 1 && (
                                        <span className="absolute left-[15px] top-8 h-[calc(100%-16px)] w-px bg-border" />
                                    )}
                                    <span className="relative z-10 grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                                        <Check className="size-4" />
                                    </span>
                                    <div className="pt-1">
                                        <p className="font-bold">
                                            {item.toStatus}
                                        </p>
                                        {item.note && (
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                {item.note}
                                            </p>
                                        )}
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {new Date(
                                                item.createdAt,
                                            ).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            ))}

                            {!query.data.timeline.length && (
                                <div className="flex gap-3 text-muted-foreground">
                                    <CircleDashed /> No timeline updates yet.
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            )}
        </main>
    );
}

function TrackingField({
    label,
    value,
    onChange,
    placeholder,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
}) {
    return (
        <label className="grid gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {label}
            </span>
            <input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                className="h-12 rounded-xl border bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
        </label>
    );
}

function StatusCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-2xl border bg-background p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {label}
            </p>
            <p className="mt-1 font-black">{value}</p>
        </div>
    );
}
