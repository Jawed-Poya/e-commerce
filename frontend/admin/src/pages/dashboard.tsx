import { useI18n } from "@/i18n/i18n-provider";

const Dashboard = () => {
    const { t } = useI18n();
    return (
        <>
            <div>{t("nav.dashboard")}</div>
            <div>{t("nav.dashboard")}</div>
        </>
    );
};

export default Dashboard;
