import { Button } from "@/components/ui/button";
import { Entities } from "@/constants/entities";
import { GeneralTypeDialog } from "@/features/general-types/components/general-type-modal";
import { GeneralTypesTable } from "@/features/general-types/components/general-type-table";
import { useModal } from "@/hooks/use-modal";
import { Plus } from "lucide-react";
import { useI18n } from "@/i18n/i18n-provider";

export default function GeneralTypesPage() {
    const { t } = useI18n();
    const { open } = useModal(Entities.GeneralType, "create");

    return (
        <>
            <div
                className="
                flex
                items-center
                justify-between
                mb-4
            "
            >
                <div>
                    <h1
                        className="
                        text-2xl
                        font-bold
                    "
                    >
                        {t("types.title")}
                    </h1>

                    <p
                        className="
                        text-sm
                        text-muted-foreground
                    "
                    >
                        {t("types.subtitle")}
                    </p>
                </div>

                <Button onClick={open}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t("types.add")}
                </Button>
                <GeneralTypeDialog />
            </div>

            <GeneralTypesTable />
        </>
    );
}
