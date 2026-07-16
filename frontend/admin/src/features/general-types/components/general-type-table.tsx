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
import { Pencil, LoaderCircle, FolderTree } from "lucide-react";
import { useModal } from "@/hooks/use-modal";
import { Entities } from "@/constants/entities";
import { DeleteButton } from "@/components/delete-button";
import { useDeleteGeneralType } from "../hooks/use-delete-type";

import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { generalTypeKeys } from "@/keys/type-keys";
import { useI18n } from "@/i18n/i18n-provider";
import type { GeneralType } from "@/schemas/type.schema";
import { getGroupLabelKey } from "../type-groups";

export function GeneralTypesTable({ rows, allRows, isLoading, isError, onRetry }: { rows: GeneralType[]; allRows: GeneralType[]; isLoading: boolean; isError: boolean; onRetry: () => void }) {
    const { t } = useI18n();
    const queryClient = useQueryClient();
    const itemMap = new Map(allRows.map(item => [item.id, item]));
    const getDepth = (item: GeneralType) => { let depth = 0; let parentId = item.parentId; const visited = new Set<number>(); while (parentId && !visited.has(parentId)) { visited.add(parentId); depth += 1; parentId = itemMap.get(parentId)?.parentId; } return depth; };

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
                    loading: t("types.deleting"),
                    success: t("types.deleted"),
                    error: t("types.deleteError"),
                },
            );
        } catch (error) {
            // toast.promise presents the localized failure message.
            throw error;
        }
    };

    return (
        <div className="overflow-hidden border"><Table>
            <TableHeader>
                <TableRow>
                    <TableHead>{t("form.name")}</TableHead>

                    <TableHead>{t("types.group")}</TableHead>

                    <TableHead>{t("form.parent")}</TableHead>

                    <TableHead className="w-30">{t("types.actions")}</TableHead>
                </TableRow>
            </TableHeader>

            <TableBody>
                {isLoading && <TableRow><TableCell colSpan={4} className="h-40 text-center"><LoaderCircle className="mx-auto size-5 animate-spin" /><span className="mt-2 block text-muted-foreground">{t("types.loading")}</span></TableCell></TableRow>}
                {isError && <TableRow><TableCell colSpan={4} className="h-40 text-center"><p className="mb-3 text-destructive">{t("types.loadError")}</p><Button variant="outline" onClick={onRetry}>{t("types.retry")}</Button></TableCell></TableRow>}
                {!isLoading && !isError && rows.length === 0 && <TableRow><TableCell colSpan={4} className="h-40 text-center"><FolderTree className="mx-auto mb-3 size-8 text-muted-foreground" /><p className="font-medium">{t("types.empty")}</p><p className="mt-1 text-xs text-muted-foreground">{t("types.emptyHelp")}</p></TableCell></TableRow>}
                {!isLoading && !isError && rows.map((type) => (
                    <TableRow key={type.id}>
                        <TableCell><div className="flex items-center" style={{ paddingInlineStart: `${getDepth(type) * 20}px` }}>{getDepth(type) > 0 && <span className="me-2 text-muted-foreground">└</span>}<span className="font-medium">{type.name}</span></div></TableCell>

                        <TableCell>
                            <Badge variant="secondary">{t(getGroupLabelKey(type.group))}</Badge>
                        </TableCell>

                        <TableCell>{type.parentName ?? "-"}</TableCell>

                        <TableCell>
                            <div className="flex gap-2">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => open(type)}
                                    aria-label={`${t("types.edit")} ${type.name}`}
                                >
                                    <Pencil className="h-4 w-4" />
                                </Button>

                                <DeleteButton
                                    id={type.id!}
                                    onDelete={handleDelete}
                                    title={t("types.deleteTitle")}
                                    description={t("types.deleteDescription")}
                                    cancelLabel={t("form.cancel")}
                                    confirmLabel={t("types.delete")}
                                    loadingLabel={t("types.deleting")}
                                />
                            </div>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table></div>
    );
}
