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
            onOpenChange={() => {
                isEdit ? close() : closeCreate();
            }}
        >
            <DialogContent className="min-w-2xl">
                <DialogHeader>
                    <DialogTitle>{isEdit ? t("types.edit") : t("types.create")}</DialogTitle>

                    <DialogDescription>
                        {t("types.subtitle")}
                    </DialogDescription>
                </DialogHeader>

                <GeneralTypeForm
                    defaultValues={{
                        group: defaultGroup,
                        ...data,
                    }}
                    isLoading={isPending || isPendingUpdate}
                    onSubmit={(data) => {
                        if (data.id && data.id > 0) {
                            mutateUpdate(
                                {
                                    id: data.id,
                                    data,
                                },
                                {
                                    onSuccess: () => {
                                        queryClient.invalidateQueries({
                                            queryKey: generalTypeKeys.all,
                                        });
                                        close();
                                    },
                                },
                            );
                            return;
                        }
                        mutate(data, {
                            onSuccess: () => {
                                queryClient.invalidateQueries({
                                    queryKey: generalTypeKeys.all,
                                });
                                closeCreate();
                            },
                        });
                    }}
                />
            </DialogContent>
        </Dialog>
    );
}
