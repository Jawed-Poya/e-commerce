import { useI18n } from "@/i18n/i18n-provider";
import { PageHeader } from "@/components/page-header";

const Dashboard = () => {
    const { t } = useI18n();
    return (
        <PageHeader title={t("nav.dashboard")} description={t("dashboard.subtitle")} />
    );
};

export default Dashboard;
