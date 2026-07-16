import { Button } from "@/components/ui/button";
import { Entities } from "@/constants/entities";
import { GeneralTypeDialog } from "@/features/general-types/components/general-type-modal";
import { GeneralTypesTable } from "@/features/general-types/components/general-type-table";
import { useModal } from "@/hooks/use-modal";
import { Plus, Search, RotateCw } from "lucide-react";
import { useI18n } from "@/i18n/i18n-provider";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useGeneralTypes } from "@/features/general-types/hooks/use-type";
import { GENERAL_TYPE_GROUPS } from "@/features/general-types/type-groups";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";

export default function GeneralTypesPage() {
    const { t } = useI18n();
    const { open } = useModal(Entities.GeneralType, "create");
    const [group, setGroup] = useState("All");
    const [search, setSearch] = useState("");
    const { data, isLoading, isError, refetch } = useGeneralTypes(undefined);
    const allRows = useMemo(() => data?.data ?? [], [data]);
    const rows = useMemo(() => allRows.filter(item => (group === "All" || item.group === group) && item.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())), [allRows, group, search]);

    return (
        <div className="space-y-6">
            <PageHeader title={t("types.title")} description={t("types.subtitle")} actions={<>
                <Button onClick={open}>
                    <Plus className="me-2 size-4" />
                    {t("types.add")}
                </Button>
            </>} />
            <section className="space-y-4 border p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <ToggleGroup variant="outline" value={[group]} onValueChange={value => value[0] && setGroup(value[0])} className="flex flex-wrap justify-start">
                        <ToggleGroupItem value="All">{t("types.all")}</ToggleGroupItem>
                        {GENERAL_TYPE_GROUPS.map(item => <ToggleGroupItem key={item.value} value={item.value}>{t(item.labelKey)}</ToggleGroupItem>)}
                    </ToggleGroup>
                    <div className="flex items-center gap-2">
                        <div className="relative min-w-0 flex-1 sm:w-72"><Search className="absolute start-3 top-2.5 size-4 text-muted-foreground" /><Input className="ps-9" value={search} onChange={event => setSearch(event.target.value)} placeholder={t("types.search")} /></div>
                        <Badge variant="secondary" className="h-8 px-3">{rows.length} / {allRows.length}</Badge>
                        <Button variant="outline" size="icon" aria-label={t("types.refresh")} onClick={() => refetch()}><RotateCw className="size-4" /></Button>
                    </div>
                </div>
                <GeneralTypesTable rows={rows} allRows={allRows} isLoading={isLoading} isError={isError} onRetry={() => refetch()} />
            </section>
            <GeneralTypeDialog defaultGroup={group === "All" ? undefined : group} />
        </div>
    );
}
