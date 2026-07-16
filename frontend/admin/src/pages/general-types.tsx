import { Button } from "@/components/ui/button";
import { Entities } from "@/constants/entities";
import { GeneralTypeDialog } from "@/features/general-types/components/general-type-modal";
import { GeneralTypesTable } from "@/features/general-types/components/general-type-table";
import { useModal } from "@/hooks/use-modal";
import { Plus } from "lucide-react";

export default function GeneralTypesPage() {
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
                        General Types
                    </h1>

                    <p
                        className="
                        text-sm
                        text-muted-foreground
                    "
                    >
                        Manage your store General Types
                    </p>
                </div>

                <Button onClick={open}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Type
                </Button>
                <GeneralTypeDialog />
            </div>

            <GeneralTypesTable />
        </>
    );
}
