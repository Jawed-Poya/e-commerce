import { useState, type ReactElement } from "react";
import { AlertTriangle } from "lucide-react";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogMedia,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useI18n } from "@/i18n/i18n-provider";

interface ConfirmActionDialogProps {
    trigger?: ReactElement;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    title: string;
    description: string;
    confirmLabel?: string;
    destructive?: boolean;
    pending?: boolean;
    elevated?: boolean;
    onConfirm: () => void | Promise<void>;
}

export function ConfirmActionDialog({
    trigger,
    open: controlledOpen,
    onOpenChange,
    title,
    description,
    confirmLabel,
    destructive = false,
    pending = false,
    elevated = false,
    onConfirm,
}: ConfirmActionDialogProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const { t } = useI18n();
    const open = controlledOpen ?? internalOpen;

    const setOpen = (nextOpen: boolean) => {
        if (controlledOpen === undefined) {
            setInternalOpen(nextOpen);
        }
        onOpenChange?.(nextOpen);
    };

    const handleConfirm = async () => {
        try {
            await onConfirm();
            setOpen(false);
        } catch {
            // The mutation owns user-facing error reporting; keep the dialog open.
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            {trigger ? <AlertDialogTrigger render={trigger} /> : null}
            <AlertDialogContent
                className={elevated ? "z-[120]" : undefined}
                overlayClassName={elevated ? "z-[120]" : undefined}
            >
                <AlertDialogHeader>
                    <AlertDialogMedia
                        className={
                            destructive
                                ? "bg-destructive/10 text-destructive"
                                : undefined
                        }
                    >
                        <AlertTriangle />
                    </AlertDialogMedia>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {description}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={pending}>
                        {t("form.cancel")}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        variant={destructive ? "destructive" : "default"}
                        disabled={pending}
                        onClick={() => void handleConfirm()}
                    >
                        {pending ? t("common.working") : confirmLabel || t("common.continue")}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
