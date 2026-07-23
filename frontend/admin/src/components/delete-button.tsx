import { useState } from "react";
import { Trash2 } from "lucide-react";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface DeleteButtonProps {
    id: number | string;
    onDelete: (id: number | string) => Promise<unknown>;
    title?: string;
    description?: string;
    cancelLabel?: string;
    confirmLabel?: string;
    loadingLabel?: string;
    triggerLabel?: string;
}

export function DeleteButton({
    id,
    onDelete,
    title = "Delete this item?",
    description = "This action cannot be undone. The selected item will be permanently deleted.",
    cancelLabel = "Cancel",
    confirmLabel = "Delete",
    loadingLabel = "Deleting...",
    triggerLabel,
}: DeleteButtonProps) {
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);

    const handleDelete = async () => {
        try {
            setLoading(true);
            await onDelete(id);
            setOpen(false);
        } catch {
            // The caller owns the user-facing error message; keep the dialog open.
        } finally {
            setLoading(false);
        }
    };

    return (
        <AlertDialog
            open={open}
            onOpenChange={(value) => {
                if (!loading) {
                    setOpen(value);
                }
            }}
        >
            <AlertDialogTrigger>
                <Button variant="destructive" size={triggerLabel ? "default" : "icon"} aria-label={confirmLabel}>
                    <Trash2 className="size-4" />
                    {triggerLabel}
                </Button>
            </AlertDialogTrigger>

            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>

                    <AlertDialogDescription>
                        {description}
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <AlertDialogFooter>
                    <AlertDialogCancel disabled={loading}>
                        {cancelLabel}
                    </AlertDialogCancel>

                    <AlertDialogAction
                        disabled={loading}
                        onClick={async (e) => {
                            e.preventDefault();
                            await handleDelete();
                        }}
                    >
                        {loading ? loadingLabel : confirmLabel}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
