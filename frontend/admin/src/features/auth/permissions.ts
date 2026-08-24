import type { AuthUser } from "./auth-types";

export const Permissions = {
    DashboardView: "dashboard.view",
    ProductsView: "products.view",
    ProductsManage: "products.manage",
    ProductPricingManage: "product-pricing.manage",
    ReviewsView: "reviews.view",
    ReviewsManage: "reviews.manage",
    InventoryView: "inventory.view",
    InventoryManage: "inventory.manage",
    OrdersView: "orders.view",
    OrdersManage: "orders.manage",
    PaymentsManage: "payments.manage",
    CustomersView: "customers.view",
    CustomersManage: "customers.manage",
    UsersView: "users.view",
    UsersManage: "users.manage",
    RolesManage: "roles.manage",
    OperationsView: "operations.view",
    PurchasesView: "purchases.view",
    PurchasesManage: "purchases.manage",
    ManualSalesView: "manual-sales.view",
    ManualSalesManage: "manual-sales.manage",
    StaffView: "staff.view",
    StaffManage: "staff.manage",
    PayrollView: "payroll.view",
    PayrollManage: "payroll.manage",
    ExpensesView: "expenses.view",
    ExpensesManage: "expenses.manage",
    OperationLineLimitsManage: "operations.line-limits.manage",
    OperationLineLimitsOverride: "operations.line-limits.override",
    SystemManage: "system.manage",
    CompanyProfileManage: "company.profile.manage",
    CompanyBranchesManage: "company.branches.manage",
    CompanyClaimsManage: "company.claims.manage",
    FinancialReportsView: "company.reports.view",
    CompanyTrashManage: "company.trash.manage",
    CompanySettingsManage: "company.settings.manage",
    AuditLogsView: "company.audit-logs.view",
    NotificationsManage: "company.notifications.manage",
    GeneralTypesManage: "system.general-types.manage",
    StorefrontManage: "system.storefront.manage",
    DatabaseMaintenanceView: "database-maintenance.view",
    DatabaseBackup: "database.backup",
    DatabaseRestore: "database.restore",
    BranchDataClear: "data.clear.branch",
    AllBusinessDataClear: "data.clear.all",
    DemoDataSeed: "data.seed.demo",
} as const;

export function isSystemAdministrator(
    user: Pick<AuthUser, "roles"> | null | undefined,
) {
    return Boolean(user?.roles.some((role) => role.toLowerCase() === "admin"));
}

const legacyPermissionParents: Readonly<Record<string, readonly string[]>> = {
    [Permissions.ReviewsView]: [Permissions.ProductsManage],
    [Permissions.ReviewsManage]: [Permissions.ProductsManage],
    [Permissions.NotificationsManage]: [Permissions.OrdersManage],
    [Permissions.GeneralTypesManage]: [Permissions.SystemManage],
    [Permissions.StorefrontManage]: [Permissions.SystemManage],
    [Permissions.BranchDataClear]: [Permissions.AllBusinessDataClear],
};

export function hasPermission(
    user: Pick<AuthUser, "roles" | "permissions"> | null | undefined,
    permission: string,
) {
    if (isSystemAdministrator(user)) return true;
    const granted = new Set(user?.permissions ?? []);
    return granted.has(permission) ||
        (legacyPermissionParents[permission]?.some((parent) => granted.has(parent)) ?? false);
}

export function getDefaultAdminRoute(
    _permissions: string[],
    _roles: string[] = [],
) {
    return "/";
}
