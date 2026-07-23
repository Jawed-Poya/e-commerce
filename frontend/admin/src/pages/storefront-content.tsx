import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, LoaderCircle, MonitorSmartphone, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiOrigin } from "@/api/axios";
import { storefrontContentService } from "@/features/storefront-content/storefront-content-service";
import type {
    LocalizedHeroContent,
    UpdateStorefrontContentRequest,
} from "@/features/storefront-content/storefront-content-types";

const emptyLocale: LocalizedHeroContent = {
    eyebrow: "",
    title: "",
    description: "",
    primaryButtonText: "",
    secondaryButtonText: "",
};

const initialForm: UpdateStorefrontContentRequest = {
    heroImageUrl: null,
    primaryButtonUrl: "/products",
    secondaryButtonUrl: "/products?featured=true",
    en: { ...emptyLocale },
    ps: { ...emptyLocale },
    dr: { ...emptyLocale },
};

export default function StorefrontContentPage() {
    const queryClient = useQueryClient();
    const [form, setForm] = useState(initialForm);
    const [activeLanguage, setActiveLanguage] = useState<"en" | "ps" | "dr">("en");

    const content = useQuery({
        queryKey: ["storefront-content"],
        queryFn: storefrontContentService.get,
    });

    useEffect(() => {
        if (!content.data) return;
        const { updatedAt: _updatedAt, ...request } = content.data;
        setForm(request);
    }, [content.data]);

    const save = useMutation({
        mutationFn: () => storefrontContentService.update(form),
        onSuccess: async () => {
            toast.success("Storefront hero updated.");
            await queryClient.invalidateQueries({ queryKey: ["storefront-content"] });
        },
        onError: (error) => toast.error(errorMessage(error)),
    });

    const upload = useMutation({
        mutationFn: storefrontContentService.uploadHeroImage,
        onSuccess: (heroImageUrl) => {
            setForm((current) => ({ ...current, heroImageUrl }));
            toast.success("Hero image uploaded. Save the page to publish it.");
        },
        onError: (error) => toast.error(errorMessage(error)),
    });

    const locale = form[activeLanguage];
    const updateLocale = (key: keyof LocalizedHeroContent, value: string) =>
        setForm((current) => ({
            ...current,
            [activeLanguage]: {
                ...current[activeLanguage],
                [key]: value,
            },
        }));

    const previewImage = form.heroImageUrl
        ? /^https?:/.test(form.heroImageUrl)
            ? form.heroImageUrl
            : `${apiOrigin}${form.heroImageUrl}`
        : null;

    return (
        <div className="space-y-5">
            <PageHeader
                title="Storefront hero"
                description="Manage the homepage hero text, links, image, and translations without rebuilding the website."
                actions={
                    <Button onClick={() => save.mutate()} disabled={save.isPending || content.isLoading}>
                        {save.isPending ? <LoaderCircle className="animate-spin" /> : <Save />}
                        Publish changes
                    </Button>
                }
            />

            <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
                <div className="space-y-5">
                    <Card>
                        <CardHeader>
                            <CardTitle>Hero image and links</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2 md:col-span-2">
                                <Label>Hero image URL</Label>
                                <div className="flex flex-col gap-2 sm:flex-row">
                                    <Input
                                        value={form.heroImageUrl ?? ""}
                                        placeholder="/uploads/storefront/hero.webp or https://..."
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                heroImageUrl: event.target.value || null,
                                            }))
                                        }
                                    />
                                    <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 border bg-background px-4 text-sm font-medium hover:bg-muted">
                                        {upload.isPending ? (
                                            <LoaderCircle className="size-4 animate-spin" />
                                        ) : (
                                            <ImagePlus className="size-4" />
                                        )}
                                        Upload image
                                        <input
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp,image/avif"
                                            className="sr-only"
                                            disabled={upload.isPending}
                                            onChange={(event) => {
                                                const file = event.target.files?.[0];
                                                if (file) upload.mutate(file);
                                                event.currentTarget.value = "";
                                            }}
                                        />
                                    </label>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Primary button URL</Label>
                                <Input
                                    value={form.primaryButtonUrl}
                                    onChange={(event) =>
                                        setForm((current) => ({
                                            ...current,
                                            primaryButtonUrl: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Secondary button URL</Label>
                                <Input
                                    value={form.secondaryButtonUrl}
                                    onChange={(event) =>
                                        setForm((current) => ({
                                            ...current,
                                            secondaryButtonUrl: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="gap-4">
                            <div>
                                <CardTitle>Localized content</CardTitle>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Complete every language before publishing.
                                </p>
                            </div>
                            <div className="flex gap-2">
                                {(["en", "dr", "ps"] as const).map((language) => (
                                    <Button
                                        key={language}
                                        type="button"
                                        variant={activeLanguage === language ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setActiveLanguage(language)}
                                    >
                                        {language === "en" ? "English" : language === "dr" ? "دری" : "پښتو"}
                                    </Button>
                                ))}
                            </div>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <Field label="Eyebrow" value={locale.eyebrow} onChange={(value) => updateLocale("eyebrow", value)} />
                            <Field label="Title" value={locale.title} onChange={(value) => updateLocale("title", value)} />
                            <div className="space-y-2">
                                <Label>Description</Label>
                                <Textarea
                                    rows={5}
                                    dir={activeLanguage === "en" ? "ltr" : "rtl"}
                                    value={locale.description}
                                    onChange={(event) => updateLocale("description", event.target.value)}
                                />
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                <Field label="Primary button text" value={locale.primaryButtonText} onChange={(value) => updateLocale("primaryButtonText", value)} />
                                <Field label="Secondary button text" value={locale.secondaryButtonText} onChange={(value) => updateLocale("secondaryButtonText", value)} />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card className="h-fit overflow-hidden xl:sticky xl:top-24">
                    <CardHeader className="flex-row items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <MonitorSmartphone className="size-5 text-primary" /> Live preview
                        </CardTitle>
                        <Badge variant="outline">{activeLanguage.toUpperCase()}</Badge>
                    </CardHeader>
                    <CardContent>
                        <div
                            dir={activeLanguage === "en" ? "ltr" : "rtl"}
                            className="relative min-h-[470px] overflow-hidden rounded-2xl border bg-muted"
                        >
                            {previewImage && (
                                <img src={previewImage} alt="Hero preview" className="absolute inset-0 size-full object-cover" />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/95 to-background/25 rtl:bg-gradient-to-l" />
                            <div className="relative flex min-h-[470px] max-w-xl flex-col justify-center p-8">
                                <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">{locale.eyebrow}</p>
                                <h2 className="mt-4 text-4xl font-black leading-tight tracking-tight">{locale.title || "Hero title"}</h2>
                                <p className="mt-4 text-sm leading-7 text-muted-foreground">{locale.description}</p>
                                <div className="mt-6 flex flex-wrap gap-3">
                                    <Button>{locale.primaryButtonText || "Primary"}</Button>
                                    <Button variant="outline">{locale.secondaryButtonText || "Secondary"}</Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            <Input value={value} onChange={(event) => onChange(event.target.value)} />
        </div>
    );
}

function errorMessage(error: unknown) {
    return (
        (error as { response?: { data?: { message?: string } } }).response?.data?.message ??
        "The storefront content could not be saved."
    );
}
