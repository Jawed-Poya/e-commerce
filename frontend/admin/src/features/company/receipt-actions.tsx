import { FileImage, FileText, MoreHorizontal, Printer, ReceiptText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/i18n/i18n-provider";
import { companyService } from "./company-service";

interface ReceiptActionsProps {
    source: "orders" | "manual-sales";
    id: number;
    compact?: boolean;
}

export function ReceiptActions({ source, id, compact = false }: ReceiptActionsProps) {
    const [downloading, setDownloading] = useState(false);
    const { tr } = useI18n();

    const download = async (format: "pdf" | "image", thermal = false) => {
        setDownloading(true);
        try {
            await companyService.downloadReceipt(source, id, format, thermal);
            toast.success(tr(format === "pdf" ? "PDF generated successfully." : "Receipt image generated successfully."));
        } catch (error) {
            toast.error(tr(getErrorMessage(error)));
        } finally {
            setDownloading(false);
        }
    };

    const previewForPrint = async () => {
        const preview = window.open("", "_blank");
        if (!preview) {
            toast.error(tr("Allow pop-ups to preview and print the receipt."));
            return;
        }

        preview.opener = null;
        preview.document.title = tr("Preparing receipt…");
        preview.document.body.innerHTML = `<p style="font-family:system-ui;padding:24px">${tr("Preparing receipt…")}</p>`;
        setDownloading(true);
        try {
            const url = await companyService.receiptPreviewUrl(source, id);
            preview.location.href = url;
            window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } catch (error) {
            preview.close();
            toast.error(tr(getErrorMessage(error)));
        } finally {
            setDownloading(false);
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button
                        variant="outline"
                        size={compact ? "icon-sm" : "sm"}
                        disabled={downloading}
                        aria-label="Download receipt"
                    />
                }
            >
                {compact ? <MoreHorizontal /> : <><ReceiptText />Receipt</>}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Customer receipt</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => void previewForPrint()}>
                    <Printer /> Print / preview
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void download("pdf")}>
                    <FileText /> A4 PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void download("pdf", true)}>
                    <ReceiptText /> Thermal PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void download("image")}>
                    <FileImage /> Receipt image
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function getErrorMessage(error: unknown) {
    const responseMessage = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
    if (typeof responseMessage === "string" && responseMessage.trim()) return responseMessage.trim();
    if (error instanceof Error && error.message.trim()) return error.message.trim();
    return "Could not generate the receipt.";
}
