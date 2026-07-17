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
