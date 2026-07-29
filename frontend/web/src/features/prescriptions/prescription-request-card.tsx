import { useMutation } from "@tanstack/react-query";
import {
    CheckCircle2,
    FileImage,
    FileText,
    LoaderCircle,
    ShieldCheck,
    UploadCloud,
    X,
} from "lucide-react";
import { useRef, useState, type ChangeEvent, type DragEvent } from "react";

import { useI18n } from "../../i18n/i18n-provider";
import { ApiError } from "../../shared/api/api-client";
import { Button } from "../../shared/components/ui/button";
import { Input } from "../../shared/components/ui/input";
import { Textarea } from "../../shared/components/ui/textarea";
import { cn } from "../../shared/lib/utils";
import { createPrescriptionRequest } from "./prescription-api";

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const supportedTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
]);

export function PrescriptionRequestCard({ compact = false }: { compact?: boolean }) {
    const { t } = useI18n();
    const fileInput = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [dragging, setDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fields, setFields] = useState({
        fullName: "",
        phone: "",
        email: "",
        notes: "",
    });

    const request = useMutation({
        mutationFn: createPrescriptionRequest,
        onSuccess: () => {
            setFile(null);
            setFields({ fullName: "", phone: "", email: "", notes: "" });
            setError(null);
        },
        onError: (mutationError) => {
            setError(
                mutationError instanceof ApiError && mutationError.status === 429
                    ? t("prescription.rateLimitError")
                    : mutationError instanceof Error
                      ? mutationError.message
                      : t("prescription.submitError"),
            );
        },
    });

    const chooseFile = (candidate?: File | null) => {
        if (!candidate) return;
        if (!supportedTypes.has(candidate.type)) {
            setError(t("prescription.fileTypeError"));
            return;
        }
        if (candidate.size > MAX_FILE_SIZE) {
            setError(t("prescription.fileSizeError"));
            return;
        }
        setFile(candidate);
        setError(null);
    };

    const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = event.target;
        setFields((current) => ({ ...current, [name]: value }));
    };

    const handleDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setDragging(false);
        chooseFile(event.dataTransfer.files.item(0));
    };

    const submit = () => {
        setError(null);
        if (!fields.fullName.trim() || !fields.phone.trim()) {
            setError(t("prescription.contactRequired"));
            return;
        }
        if (!file) {
            setError(t("prescription.fileRequired"));
            return;
        }
        request.mutate({ ...fields, attachment: file });
    };

    if (request.isSuccess) {
        return (
            <div className="flex h-full min-h-[350px] flex-col items-center justify-center rounded-[24px] border border-emerald-500/25 bg-emerald-500/[0.06] p-7 text-center dark:border-emerald-400/25">
                <span className="grid size-14 place-items-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
                    <CheckCircle2 className="size-7" />
                </span>
                <h3 className="mt-5 text-xl font-black tracking-[-0.025em]">
                    {t("prescription.successTitle")}
                </h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                    {t("prescription.successDescription")}
                </p>
                <div className="mt-5 rounded-xl border border-emerald-500/20 bg-background/80 px-4 py-3 text-sm shadow-sm">
                    <span className="text-muted-foreground">{t("prescription.requestNumber")}</span>
                    <strong className="ms-2 font-black text-emerald-600 dark:text-emerald-400">
                        {request.data.requestNumber}
                    </strong>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    className="mt-5 rounded-xl"
                    onClick={() => request.reset()}
                >
                    {t("prescription.submitAnother")}
                </Button>
            </div>
        );
    }

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                submit();
            }}
            className={cn(
                "h-full rounded-[24px] border border-border/80 bg-card shadow-[0_18px_55px_-42px_rgba(15,23,42,.55)] dark:border-white/12",
                compact ? "p-5" : "p-6 sm:p-7",
            )}
        >
            <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                    <FileText className="size-5" />
                </span>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">
                        {t("prescription.eyebrow")}
                    </p>
                    <h3 className="mt-1 text-xl font-black tracking-[-0.025em]">
                        {t("prescription.title")}
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {t("prescription.description")}
                    </p>
                </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Input
                    name="fullName"
                    value={fields.fullName}
                    onChange={handleInput}
                    placeholder={t("prescription.fullName")}
                    className="h-11 rounded-xl bg-background"
                    maxLength={160}
                    minLength={2}
                    autoComplete="name"
                    required
                />
                <Input
                    name="phone"
                    value={fields.phone}
                    onChange={handleInput}
                    placeholder={t("prescription.phone")}
                    className="h-11 rounded-xl bg-background"
                    maxLength={40}
                    minLength={5}
                    inputMode="tel"
                    autoComplete="tel"
                    required
                />
                <Input
                    name="email"
                    value={fields.email}
                    onChange={handleInput}
                    placeholder={t("prescription.emailOptional")}
                    className="h-11 rounded-xl bg-background sm:col-span-2"
                    type="email"
                    maxLength={256}
                    autoComplete="email"
                />
                {!compact ? (
                    <Textarea
                        value={fields.notes}
                        onChange={(event) =>
                            setFields((current) => ({
                                ...current,
                                notes: event.target.value,
                            }))
                        }
                        placeholder={t("prescription.notes")}
                        className="min-h-20 rounded-xl bg-background sm:col-span-2"
                        maxLength={1500}
                    />
                ) : null}
            </div>

            <div
                role="button"
                tabIndex={0}
                onClick={() => fileInput.current?.click()}
                onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        fileInput.current?.click();
                    }
                }}
                onDragEnter={(event) => {
                    event.preventDefault();
                    setDragging(true);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                aria-label={t("prescription.chooseFile")}
                className={cn(
                    "mt-4 flex w-full items-center gap-3 rounded-2xl border border-dashed p-4 text-start transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    dragging
                        ? "border-primary bg-primary/8"
                        : "border-primary/35 bg-primary/[0.035] hover:border-primary/60 hover:bg-primary/[0.06]",
                )}
            >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-background text-primary shadow-sm">
                    {file?.type === "application/pdf" ? (
                        <FileText className="size-5" />
                    ) : file ? (
                        <FileImage className="size-5" />
                    ) : (
                        <UploadCloud className="size-5" />
                    )}
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">
                        {file?.name ?? t("prescription.chooseFile")}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        {file
                            ? t("prescription.fileReady", {
                                  size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
                              })
                            : t("prescription.fileHelp")}
                    </span>
                </span>
                {file ? (
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            setFile(null);
                        }}
                        className="grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        aria-label={t("common.remove")}
                    >
                        <X className="size-4" />
                    </button>
                ) : null}
            </div>
            <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={(event) => {
                    chooseFile(event.target.files?.item(0));
                    event.target.value = "";
                }}
            />

            {error ? (
                <p role="alert" className="mt-3 rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive">
                    {error}
                </p>
            ) : null}

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="flex items-center gap-2 text-[11px] leading-5 text-muted-foreground">
                    <ShieldCheck className="size-4 shrink-0 text-primary" />
                    {t("prescription.privacy")}
                </span>
                <Button
                    type="submit"
                    className="h-11 shrink-0 rounded-xl px-5 font-bold"
                    disabled={request.isPending}
                >
                    {request.isPending ? (
                        <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                        <UploadCloud className="size-4" />
                    )}
                    {request.isPending
                        ? t("prescription.submitting")
                        : t("prescription.submit")}
                </Button>
            </div>
        </form>
    );
}
