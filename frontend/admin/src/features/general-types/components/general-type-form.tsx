import {
    useEffect,
    useMemo,
    useState,
    type ChangeEvent,
} from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImageIcon, Link2, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useI18n } from "@/i18n/i18n-provider";
import {
    IMAGE_FILE_ACCEPT,
    isSupportedImageFile,
    MAXIMUM_IMAGE_FILE_SIZE,
} from "@/lib/image-files";
import { flattenTree } from "@/lib/utils";
import { GeneralTypeSchema, type GeneralType } from "@/schemas/type.schema";
import { resolveGeneralTypeImageUrl } from "@/services/type.service";

import { useGeneralTypes } from "../hooks/use-type";
import { GENERAL_TYPE_GROUPS } from "../type-groups";

type ImageSource = "upload" | "url";

interface GeneralTypeFormProps {
    defaultValues?: Partial<GeneralType>;
    onSubmit: (data: GeneralType, image?: File) => void;
    isLoading?: boolean;
}

function isOnlineImageUrl(value: string | null | undefined) {
    return Boolean(value && /^https?:\/\//i.test(value));
}

function isValidOnlineImageUrl(value: string) {
    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
}

export function GeneralTypeForm({
    defaultValues,
    onSubmit,
    isLoading,
}: GeneralTypeFormProps) {
    const { t } = useI18n();
    const savedImageUrl = defaultValues?.imageUrl ?? null;
    const savedImageIsOnline = isOnlineImageUrl(savedImageUrl);

    const [hasImage, setHasImage] = useState(Boolean(savedImageUrl));
    const [imageSource, setImageSource] = useState<ImageSource>(
        savedImageIsOnline ? "url" : "upload",
    );
    const [onlineUrl, setOnlineUrl] = useState(
        savedImageIsOnline ? (savedImageUrl ?? "") : "",
    );
    const [imageFile, setImageFile] = useState<File>();
    const [localPreviewUrl, setLocalPreviewUrl] = useState<string>();
    const [imageError, setImageError] = useState<string>();

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        control,
        formState: { errors },
    } = useForm<GeneralType>({
        resolver: zodResolver(GeneralTypeSchema),
        defaultValues: {
            group: "ProductCategory",
            parentId: null,
            imageUrl: null,
            ...defaultValues,
        },
    });

    useEffect(() => {
        if (!imageFile) {
            setLocalPreviewUrl(undefined);
            return;
        }

        const objectUrl = URL.createObjectURL(imageFile);
        setLocalPreviewUrl(objectUrl);

        return () => URL.revokeObjectURL(objectUrl);
    }, [imageFile]);

    const selectedGroup = watch("group");
    const { data } = useGeneralTypes(selectedGroup);
    const allParents = useMemo(() => data?.data ?? [], [data]);

    const excludedIds = useMemo(() => {
        const result = new Set<number>();

        if (!defaultValues?.id) return result;

        result.add(defaultValues.id);

        const addChildren = (id: number) =>
            allParents
                .filter((item) => item.parentId === id)
                .forEach((item) => {
                    if (item.id && !result.has(item.id)) {
                        result.add(item.id);
                        addChildren(item.id);
                    }
                });

        addChildren(defaultValues.id);
        return result;
    }, [allParents, defaultValues?.id]);

    const parents = allParents.filter(
        (item) => !item.id || !excludedIds.has(item.id),
    );
    const parentId = useWatch({ control, name: "parentId" });
    const selectedParent = useMemo(
        () => parents.find((item) => item.id === parentId) ?? null,
        [parents, parentId],
    );
    const orderedParents = flattenTree(parents);

    const previewPath =
        imageSource === "url"
            ? onlineUrl
            : localPreviewUrl || (!savedImageIsOnline ? savedImageUrl : null);
    const previewUrl = resolveGeneralTypeImageUrl(previewPath);

    function selectImage(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = "";

        if (!file) return;

        // Some Windows/browser combinations provide an empty MIME value for a
        // valid image. The backend still verifies the file signature securely.
        if (!isSupportedImageFile(file)) {
            setImageError(t("types.imageFormatError"));
            return;
        }

        if (file.size > MAXIMUM_IMAGE_FILE_SIZE) {
            setImageError(t("types.imageSizeError"));
            return;
        }

        setImageError(undefined);
        setImageFile(file);
    }

    function submitForm(data: GeneralType) {
        setImageError(undefined);

        if (!hasImage) {
            onSubmit({ ...data, imageUrl: null });
            return;
        }

        if (imageSource === "url") {
            const normalizedUrl = onlineUrl.trim();

            if (!isValidOnlineImageUrl(normalizedUrl)) {
                setImageError(t("types.imageUrlError"));
                return;
            }

            onSubmit({ ...data, imageUrl: normalizedUrl });
            return;
        }

        if (!imageFile && (savedImageIsOnline || !savedImageUrl)) {
            setImageError(t("types.imageRequired"));
            return;
        }

        onSubmit(
            {
                ...data,
                imageUrl: savedImageIsOnline ? null : savedImageUrl,
            },
            imageFile,
        );
    }

    return (
        <form onSubmit={handleSubmit(submitForm)} className="space-y-4">
            <div className="space-y-6">
                <div className="space-y-2">
                    <Label>{t("types.group")}</Label>

                    <ToggleGroup
                        variant="outline"
                        value={[selectedGroup]}
                        onValueChange={(value) => {
                            if (value[0]) {
                                setValue("group", value[0], {
                                    shouldValidate: true,
                                });
                                setValue("parentId", null, {
                                    shouldValidate: true,
                                });
                            }
                        }}
                        className="flex flex-wrap"
                    >
                        {GENERAL_TYPE_GROUPS.map((item) => (
                            <ToggleGroupItem key={item.value} value={item.value}>
                                {t(item.labelKey)}
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>

                    {errors.group && (
                        <p className="text-sm text-destructive">
                            {errors.group.message}
                        </p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label>{t("form.name")} *</Label>
                    <Input placeholder={t("form.name")} {...register("name")} />
                    {errors.name && (
                        <p className="text-sm text-destructive">
                            {errors.name.message}
                        </p>
                    )}
                </div>

                <div className="border">
                    <div
                        role="switch"
                        aria-checked={hasImage}
                        tabIndex={isLoading ? -1 : 0}
                        onClick={() => !isLoading && setHasImage((value) => !value)}
                        onKeyDown={(event) => {
                            if (
                                !isLoading &&
                                (event.key === " " || event.key === "Enter")
                            ) {
                                event.preventDefault();
                                setHasImage((value) => !value);
                            }
                        }}
                        className="flex cursor-pointer items-center justify-between gap-4 p-4 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="flex size-9 shrink-0 items-center justify-center border bg-muted text-muted-foreground">
                                <ImageIcon className="size-4" />
                            </div>
                            <div className="space-y-1">
                                <Label>{t("types.useImage")}</Label>
                                <p className="text-xs text-muted-foreground">
                                    {t("types.useImageHelp")}
                                </p>
                            </div>
                        </div>
                        <Switch
                            checked={hasImage}
                            tabIndex={-1}
                            aria-hidden
                            className="pointer-events-none"
                        />
                    </div>

                    {hasImage && (
                        <div className="space-y-4 border-t p-4">
                            <div className="space-y-2">
                                <Label>{t("types.imageSource")}</Label>
                                <ToggleGroup
                                    variant="outline"
                                    spacing={0}
                                    value={[imageSource]}
                                    onValueChange={(value) => {
                                        const nextSource = value[0] as
                                            | ImageSource
                                            | undefined;

                                        if (nextSource) {
                                            setImageSource(nextSource);
                                            setImageError(undefined);
                                        }
                                    }}
                                    className="w-full"
                                >
                                    <ToggleGroupItem
                                        value="upload"
                                        className="flex-1"
                                    >
                                        <Upload className="size-4" />
                                        {t("types.uploadImage")}
                                    </ToggleGroupItem>
                                    <ToggleGroupItem
                                        value="url"
                                        className="flex-1"
                                    >
                                        <Link2 className="size-4" />
                                        {t("types.onlineUrl")}
                                    </ToggleGroupItem>
                                </ToggleGroup>
                            </div>

                            {imageSource === "upload" ? (
                                <div className="space-y-2">
                                    <Label
                                        htmlFor="general-type-image"
                                        className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 border border-dashed bg-muted/20 px-4 py-5 text-center transition-colors hover:border-primary/60 hover:bg-muted/40"
                                    >
                                        <Upload className="size-5 text-primary" />
                                        <span className="font-medium text-foreground">
                                            {imageFile?.name ??
                                                t("types.chooseImage")}
                                        </span>
                                        <span className="font-normal text-muted-foreground">
                                            {t("types.imageFileHelp")}
                                        </span>
                                    </Label>
                                    <input
                                        id="general-type-image"
                                        type="file"
                                        accept={IMAGE_FILE_ACCEPT}
                                        disabled={isLoading}
                                        onChange={selectImage}
                                        className="sr-only"
                                    />
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <Label htmlFor="general-type-image-url">
                                        {t("types.imageUrl")}
                                    </Label>
                                    <Input
                                        id="general-type-image-url"
                                        type="url"
                                        dir="ltr"
                                        value={onlineUrl}
                                        disabled={isLoading}
                                        placeholder="https://example.com/category.jpg"
                                        onChange={(event) => {
                                            setOnlineUrl(event.target.value);
                                            setImageError(undefined);
                                        }}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        {t("types.imageUrlHelp")}
                                    </p>
                                </div>
                            )}

                            {imageError && (
                                <p role="alert" className="text-sm text-destructive">
                                    {imageError}
                                </p>
                            )}

                            {previewUrl && (
                                <div className="relative overflow-hidden border bg-muted">
                                    <img
                                        src={previewUrl}
                                        alt={t("types.imagePreview")}
                                        className="h-36 w-full object-cover"
                                    />
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        size="icon-sm"
                                        className="absolute end-2 top-2"
                                        aria-label={t("types.removeImage")}
                                        onClick={() => {
                                            setHasImage(false);
                                            setImageFile(undefined);
                                            setOnlineUrl("");
                                            setImageError(undefined);
                                        }}
                                    >
                                        <X className="size-4" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="space-y-2">
                    <Label>{t("form.parent")}</Label>
                    <Combobox
                        items={parents}
                        value={selectedParent}
                        onValueChange={(value) => {
                            setValue("parentId", value?.id ?? null, {
                                shouldValidate: true,
                            });
                        }}
                        itemToStringLabel={(item) => item.name}
                    >
                        <ComboboxInput
                            className="w-full"
                            placeholder={t("types.noParent")}
                            showClear
                        />
                        <ComboboxContent>
                            <ComboboxEmpty>{t("form.noMatch")}</ComboboxEmpty>
                            <ComboboxList>
                                {orderedParents.map(({ item, depth }) => (
                                    <ComboboxItem key={item.id} value={item}>
                                        <span
                                            className={
                                                depth === 0
                                                    ? "font-medium"
                                                    : undefined
                                            }
                                            style={{
                                                paddingInlineStart: depth * 16,
                                            }}
                                        >
                                            {depth > 0 && "↳ "}
                                            {item.name}
                                        </span>
                                    </ComboboxItem>
                                ))}
                            </ComboboxList>
                        </ComboboxContent>
                    </Combobox>
                </div>
            </div>

            <div className="flex justify-end border-t pt-4">
                <Button disabled={isLoading} type="submit">
                    {isLoading ? t("types.saving") : t("form.save")}
                </Button>
            </div>
        </form>
    );
}
