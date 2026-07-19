import { ArrowLeft, Home, SearchX } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function AdminNotFoundPage() {
    const navigate = useNavigate();

    return (
        <div className="relative grid min-h-[calc(100vh-8rem)] place-items-center overflow-hidden px-4 py-12">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--primary)_12%,transparent),transparent_36%),radial-gradient(circle_at_bottom_right,color-mix(in_srgb,var(--primary)_8%,transparent),transparent_32%)]" />
            <Card className="relative w-full max-w-2xl overflow-hidden border-primary/15 shadow-xl">
                <CardContent className="grid gap-8 p-7 text-center sm:p-12">
                    <div className="mx-auto grid size-20 place-items-center rounded-3xl border border-primary/20 bg-primary/10 text-primary shadow-sm">
                        <SearchX className="size-9" />
                    </div>
                    <div>
                        <p className="text-sm font-bold uppercase tracking-[0.24em] text-primary">
                            Error 404
                        </p>
                        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
                            This admin page does not exist
                        </h1>
                        <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-muted-foreground sm:text-base">
                            The link may be outdated, the page may have moved, or your address may contain a typing mistake.
                        </p>
                    </div>
                    <div className="flex flex-col justify-center gap-3 sm:flex-row">
                        <Button variant="outline" onClick={() => navigate(-1)}>
                            <ArrowLeft /> Go back
                        </Button>
                        <Button render={<Link to="/dashboard" />}>
                            <Home /> Open dashboard
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
