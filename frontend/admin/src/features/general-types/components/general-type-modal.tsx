import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import { GeneralTypeForm } from "./general-type-form";
import { useCreateGeneralType } from "../hooks/use-create-type";
import { useModal } from "@/hooks/use-modal";
import { Entities } from "@/constants/entities";
import { useQueryClient } from "@tanstack/react-query";
import { generalTypeKeys } from "@/keys/type-keys";
import type { GeneralType } from "@/schemas/type.schema";
import { useUpdateGeneralType } from "../hooks/use-update-types";
import { useI18n } from "@/i18n/i18n-provider";
import { toast } from "sonner";
import axios from "axios";

function getSaveErrorMessage(error: unknown, fallback: string) {
    if (!axios.isAxiosError(error)) return fallback;

    const response = error.response?.data as
        | {
              message?: string;
              errors?: Record<string, string[]>;
          }
        | undefined;

    if (response?.message) return response.message;

    const validationMessage = response?.errors
        ? Object.values(response.errors).flat()[0]
        : undefined;

    return validationMessage ?? fallback;
}

interface GeneralTypeDialogProps {
    defaultGroup?: string;
}

export function GeneralTypeDialog({ defaultGroup }: GeneralTypeDialogProps) {
    const { t } = useI18n();
    const queryClient = useQueryClient();

    const {
        isOpen: isEdit,
        close,
        data: selectedType,
    } = useModal(Entities.GeneralType, "edit");

    const { isOpen: isCreate, close: closeCreate } = useModal(
        Entities.GeneralType,
        "create",
    );

    const isOpen = isEdit || isCreate;

    const { mutate, isPending } = useCreateGeneralType();
    const { mutate: mutateUpdate, isPending: isPendingUpdate } =
        useUpdateGeneralType();

    const data = isEdit ? (selectedType as GeneralType) : undefined;

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) {
                    if (isEdit) close();
                    else closeCreate();
                }
            }}
        >
            <DialogContent className="flex max-h-[calc(100dvh-1rem)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-h-[calc(100dvh-2rem)] sm:max-w-2xl">
                <DialogHeader className="shrink-0 border-b px-5 py-4 pe-14">
                    <DialogTitle>{isEdit ? t("types.edit") : t("types.create")}</DialogTitle>

                    <DialogDescription>
                        {t("types.subtitle")}
                    </DialogDescription>
                </DialogHeader>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">
                    <GeneralTypeForm
                        key={data?.id ?? `create-${defaultGroup ?? "default"}`}
                        defaultValues={{
                            group: defaultGroup,
                            ...data,
                        }}
                        isLoading={isPending || isPendingUpdate}
                        onSubmit={(data, image) => {
                            if (data.id && data.id > 0) {
                                mutateUpdate(
                                    {
                                        id: data.id,
                                        data,
                                        image,
                                    },
                                    {
                                        onSuccess: () => {
                                            queryClient.invalidateQueries({
                                                queryKey: generalTypeKeys.all,
                                            });
                                            close();
                                            toast.success(t("types.updated"));
                                        },
                                        onError: (error) =>
                                            toast.error(
                                                getSaveErrorMessage(
                                                    error,
                                                    t("types.saveError"),
                                                ),
                                            ),
                                    },
                                );
                                return;
                            }
                            mutate({ data, image }, {
                                onSuccess: () => {
                                    queryClient.invalidateQueries({
                                        queryKey: generalTypeKeys.all,
                                    });
                                    closeCreate();
                                    toast.success(t("types.created"));
                                },
                                onError: (error) =>
                                    toast.error(
                                        getSaveErrorMessage(
                                            error,
                                            t("types.saveError"),
                                        ),
                                    ),
                            });
                        }}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
