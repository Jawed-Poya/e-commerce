export const MAXIMUM_IMAGE_FILE_SIZE = 5 * 1024 * 1024;

export const IMAGE_FILE_ACCEPT =
    ".jpg,.jpeg,.png,.webp,.avif,image/jpeg,image/png,image/webp,image/avif";

const SUPPORTED_IMAGE_MIME_TYPES = new Set([
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/avif",
]);

const SUPPORTED_IMAGE_EXTENSION = /\.(jpe?g|png|webp|avif)$/i;

export function isSupportedImageFile(file: File) {
    return (
        SUPPORTED_IMAGE_MIME_TYPES.has(file.type.toLowerCase()) ||
        SUPPORTED_IMAGE_EXTENSION.test(file.name)
    );
}

const PRODUCT_IMAGE_SIZE = 400;
const PRODUCT_IMAGE_QUALITY = 0.9;

/**
 * Produces a consistent, high-quality square catalog image before upload.
 * The source is centre-cropped (never stretched), resized to 400x400, and
 * encoded as WebP to substantially reduce storage and transfer size.
 */
export async function prepareProductImage(file: File): Promise<File> {
    if (!isSupportedImageFile(file)) return file;

    const bitmap = await createImageBitmap(file);
    try {
        const sourceSize = Math.min(bitmap.width, bitmap.height);
        const sourceX = Math.max(0, (bitmap.width - sourceSize) / 2);
        const sourceY = Math.max(0, (bitmap.height - sourceSize) / 2);
        const canvas = document.createElement("canvas");
        canvas.width = PRODUCT_IMAGE_SIZE;
        canvas.height = PRODUCT_IMAGE_SIZE;

        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("Image processing is not supported in this browser.");

        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, PRODUCT_IMAGE_SIZE, PRODUCT_IMAGE_SIZE);
        context.drawImage(
            bitmap,
            sourceX,
            sourceY,
            sourceSize,
            sourceSize,
            0,
            0,
            PRODUCT_IMAGE_SIZE,
            PRODUCT_IMAGE_SIZE,
        );

        const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
                (result) => result ? resolve(result) : reject(new Error("Could not compress the product image.")),
                "image/webp",
                PRODUCT_IMAGE_QUALITY,
            );
        });
        const baseName = file.name.replace(/\.[^/.]+$/, "") || "product";
        return new File([blob], `${baseName}-400.webp`, {
            type: "image/webp",
            lastModified: file.lastModified,
        });
    } finally {
        bitmap.close();
    }
}
