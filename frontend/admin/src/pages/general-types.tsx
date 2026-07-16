import { Button } from "@/components/ui/button";
import { Entities } from "@/constants/entities";
import { GeneralTypeDialog } from "@/features/general-types/components/general-type-modal";
import { GeneralTypesTable } from "@/features/general-types/components/general-type-table";
import { useModal } from "@/hooks/use-modal";
import { Plus } from "lucide-react";
import { useI18n } from "@/i18n/i18n-provider";
import { PageHeader } from "@/components/page-header";

export default function GeneralTypesPage() {
    const { t } = useI18n();
    const { open } = useModal(Entities.GeneralType, "create");

    return (
        <>
            <PageHeader className="mb-4" title={t("types.title")} description={t("types.subtitle")} actions={<>
                <Button onClick={open}>
                    <Plus className="me-2 size-4" />
                    {t("types.add")}
                </Button>
                <GeneralTypeDialog />
            </>} />

            <GeneralTypesTable />
        </>
    );
}
