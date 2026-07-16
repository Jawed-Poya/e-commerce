import {
    useRef,
    useState,
    type ChangeEvent,
    type ClipboardEvent,
    type DragEvent,
    type KeyboardEvent,
} from "react";
import { ImagePlus, Images, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/i18n-provider";

const SupportedImageTypes = ["image/jpeg", "image/png", "image/webp"];

interface ProductBulkUploaderProps {
    disabled?: boolean;
    onImagesSelected: (files: File[]) => void;
}

function getAcceptedImages(files: File[]): File[] {
    return files.filter((file) => SupportedImageTypes.includes(file.type));
}

function getClipboardImages(clipboardData: DataTransfer): File[] {
    const files = Array.from(clipboardData.files);

    if (files.length > 0) {
        return getAcceptedImages(files);
    }

    return Array.from(clipboardData.items)
        .filter(
            (item) =>
                item.kind === "file" && SupportedImageTypes.includes(item.type),
        )
        .map((item) => item.getAsFile())
        .filter((file): file is File => file !== null);
}

export function ProductBulkUploader({
    disabled = false,
    onImagesSelected,
}: ProductBulkUploaderProps) {
    const { t } = useI18n();
    const inputRef = useRef<HTMLInputElement>(null);
    const dropZoneRef = useRef<HTMLDivElement>(null);

    const [isDragging, setIsDragging] = useState(false);

    function openFilePicker() {
        if (disabled) {
            return;
        }

        inputRef.current?.click();
    }

    function handleFiles(files: File[]) {
        if (disabled) {
            return;
        }

        const acceptedImages = getAcceptedImages(files);

        if (acceptedImages.length === 0) {
            return;
        }

        onImagesSelected(acceptedImages);
    }

    function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
        const files = Array.from(event.target.files ?? []);

        handleFiles(files);

        // Allows selecting the same files again.
        event.target.value = "";
    }

    function handleDragEnter(event: DragEvent<HTMLDivElement>) {
        event.preventDefault();
        event.stopPropagation();

        if (!disabled) {
            setIsDragging(true);
        }
    }

    function handleDragOver(event: DragEvent<HTMLDivElement>) {
        event.preventDefault();
        event.stopPropagation();

        if (!disabled) {
            event.dataTransfer.dropEffect = "copy";
            setIsDragging(true);
        }
    }

    function handleDragLeave(event: DragEvent<HTMLDivElement>) {
        event.preventDefault();
        event.stopPropagation();

        const nextTarget = event.relatedTarget as Node | null;

        if (nextTarget && event.currentTarget.contains(nextTarget)) {
            return;
        }

        setIsDragging(false);
    }

    function handleDrop(event: DragEvent<HTMLDivElement>) {
        event.preventDefault();
        event.stopPropagation();

        setIsDragging(false);

        if (disabled) {
            return;
        }

        const files = Array.from(event.dataTransfer.files);

        handleFiles(files);
        dropZoneRef.current?.focus();
    }

    function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
        if (disabled) {
            return;
        }

        const images = getClipboardImages(event.clipboardData);

        if (images.length === 0) {
            return;
        }

        event.preventDefault();

        handleFiles(images);
    }

    function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (event.key !== "Enter" && event.key !== " ") {
            return;
        }

        event.preventDefault();

        openFilePicker();
    }

    return (
        <div
            ref={dropZoneRef}
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-disabled={disabled}
            onClick={() => dropZoneRef.current?.focus()}
            onPaste={handlePaste}
            onDrop={handleDrop}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onKeyDown={handleKeyDown}
            className={cn(
                "relative rounded-xl border-2 border-dashed p-8 text-center",
                "outline-none transition-all duration-200",
                "focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10",
                isDragging
                    ? "scale-[1.01] border-primary bg-primary/10"
                    : "border-border bg-muted/20 hover:border-primary/50 hover:bg-muted/40",
                disabled &&
                    "cursor-not-allowed opacity-50 hover:border-border hover:bg-muted/20",
            )}
        >
            <input
                ref={inputRef}
                type="file"
                accept={SupportedImageTypes.join(",")}
                multiple
                disabled={disabled}
                className="hidden"
                onChange={handleInputChange}
            />

            <div
                className={cn(
                    "mx-auto flex size-16 items-center justify-center rounded-full",
                    "bg-primary/10 text-primary transition-transform duration-200",
                    isDragging && "scale-110",
                )}
            >
                {isDragging ? (
                    <Upload className="size-8 animate-bounce" />
                ) : (
                    <Images className="size-8" />
                )}
            </div>

            <h2 className="mt-4 text-lg font-semibold">
                {isDragging ? t("uploader.drop") : t("uploader.title")}
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
                {t("uploader.instructions")}
            </p>

            <p className="mt-2 text-xs text-muted-foreground">
                {t("uploader.pasteBefore")}{" "}
                <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono text-[11px]">
                    Ctrl
                </kbd>
                {" + "}
                <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono text-[11px]">
                    V
                </kbd>{" "}
                {t("uploader.pasteAfter")}
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
                {t("uploader.formats")}
            </p>

            <Button
                type="button"
                className="mt-5"
                disabled={disabled}
                onClick={(event) => {
                    event.stopPropagation();
                    openFilePicker();
                }}
            >
                <ImagePlus className="mr-2 size-4" />
                {t("uploader.choose")}
            </Button>
        </div>
    );
}
