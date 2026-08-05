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
    permissions: string[],
    roles: string[] = [],
) {
    if (roles.some((role) => role.toLowerCase() === "admin")) return "/dashboard";
    const set = new Set(permissions);
    if (set.has(Permissions.DashboardView)) return "/dashboard";
    if (set.has(Permissions.ProductsView)) return "/products";
    if (set.has(Permissions.ReviewsView) || set.has(Permissions.ProductsManage)) return "/reviews";
    if (set.has(Permissions.InventoryView)) return "/inventory";
    if (set.has(Permissions.OperationsView)) return "/operations";
    if (set.has(Permissions.PurchasesView)) return "/operations/purchases";
    if (set.has(Permissions.ManualSalesView)) return "/operations/sales";
    if (set.has(Permissions.StaffView)) return "/operations/staff";
    if (set.has(Permissions.ExpensesView)) return "/operations/expenses";
    if (set.has(Permissions.OrdersView)) return "/orders";
    if (set.has(Permissions.CustomersView)) return "/customers";
    if (set.has(Permissions.UsersView)) return "/system/users";
    if (set.has(Permissions.RolesManage)) return "/system/roles";
    if (set.has(Permissions.FinancialReportsView)) return "/reports";
    if (set.has(Permissions.CompanyProfileManage)) return "/company";
    if (set.has(Permissions.AuditLogsView)) return "/audit";
    if (set.has(Permissions.GeneralTypesManage) || set.has(Permissions.SystemManage)) return "/system/general-types";
    if (set.has(Permissions.StorefrontManage)) return "/system/storefront";
    if (
        set.has(Permissions.DatabaseMaintenanceView) ||
        set.has(Permissions.DatabaseBackup) ||
        set.has(Permissions.DatabaseRestore) ||
        set.has(Permissions.BranchDataClear) ||
        set.has(Permissions.AllBusinessDataClear) ||
        set.has(Permissions.DemoDataSeed)
    ) return "/system/maintenance";
    return "/dashboard";
}
