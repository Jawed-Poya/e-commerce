import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { useGeneralTypes } from "../hooks/use-type";
import { useModal } from "@/hooks/use-modal";
import { Entities } from "@/constants/entities";
import { DeleteButton } from "@/components/delete-button";
import { useDeleteGeneralType } from "../hooks/use-delete-type";

import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { generalTypeKeys } from "@/keys/type-keys";

export function GeneralTypesTable() {
    const queryClient = useQueryClient();
    const group = "All";
    const search = "";

    const { data } = useGeneralTypes(group === "All" ? undefined : group);

    const rows = data?.data.filter((x) =>
        x.name.toLowerCase().includes(search.toLowerCase()),
    );

    const { open } = useModal(Entities.GeneralType, "edit");

    const deleteMutation = useDeleteGeneralType();

    const handleDelete = async (id: number | string) => {
        try {
            await toast.promise(
                deleteMutation.mutateAsync(id as number, {
                    onSuccess: () => {
                        queryClient.invalidateQueries({
                            queryKey: generalTypeKeys.all,
                        });
                    },
                }),
                {
                    loading: "Deleting item...",
                    success: "Item deleted successfully.",
                    error: "Failed to delete item.",
                },
            );
        } finally {
        }
    };

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Name</TableHead>

                    <TableHead>Group</TableHead>

                    <TableHead>Parent</TableHead>

                    <TableHead className="w-30">Actions</TableHead>
                </TableRow>
            </TableHeader>

            <TableBody>
                {rows?.map((type) => (
                    <TableRow key={type.id}>
                        <TableCell>{type.name}</TableCell>

                        <TableCell>
                            <Badge variant="secondary">{type.group}</Badge>
                        </TableCell>

                        <TableCell>{type.parentName ?? "-"}</TableCell>

                        <TableCell>
                            <div className="flex gap-2">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => open(type)}
                                >
                                    <Pencil className="h-4 w-4" />
                                </Button>

                                <DeleteButton
                                    id={type.id!}
                                    onDelete={handleDelete}
                                />
                            </div>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
