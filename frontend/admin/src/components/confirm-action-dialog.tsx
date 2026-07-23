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

interface ConfirmActionDialogProps {
    trigger: ReactElement;
    title: string;
    description: string;
    confirmLabel?: string;
    destructive?: boolean;
    pending?: boolean;
    onConfirm: () => void | Promise<void>;
}

export function ConfirmActionDialog({
    trigger,
    title,
    description,
    confirmLabel = "Continue",
    destructive = false,
    pending = false,
    onConfirm,
}: ConfirmActionDialogProps) {
    const [open, setOpen] = useState(false);

    const confirm = async () => {
        try {
            await onConfirm();
            setOpen(false);
        } catch {
            // The mutation owns user-facing error reporting; keep the dialog open.
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger render={trigger} />
            <AlertDialogContent>
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
                        Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                        variant={destructive ? "destructive" : "default"}
                        disabled={pending}
                        onClick={() => void confirm()}
                    >
                        {pending ? "Working..." : confirmLabel}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
