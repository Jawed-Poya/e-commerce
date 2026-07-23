import type { AuthUser } from "./auth-types";

export const Permissions = {
    DashboardView: "dashboard.view",
    ProductsView: "products.view",
    ProductsManage: "products.manage",
    ProductPricingManage: "product-pricing.manage",
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
    SystemManage: "system.manage",
    TenantProfileManage: "tenant.profile.manage",
    TenantBranchesManage: "tenant.branches.manage",
    TenantClaimsManage: "tenant.claims.manage",
    TenantReportsView: "tenant.reports.view",
    TenantTrashManage: "tenant.trash.manage",
    TenantSettingsManage: "tenant.settings.manage",
    PlatformTenantsManage: "platform.tenants.manage",
} as const;

export function isSystemAdministrator(
    user: Pick<AuthUser, "roles" | "isPlatformAdmin"> | null | undefined,
) {
    return Boolean(user?.isPlatformAdmin || user?.roles.some((role) => role.toLowerCase() === "platformadmin"));
}

export function hasPermission(
    user: Pick<AuthUser, "roles" | "permissions" | "isPlatformAdmin"> | null | undefined,
    permission: string,
) {
    return Boolean(
        user &&
            (isSystemAdministrator(user) ||
                user.permissions.includes(permission)),
    );
}

export function getDefaultAdminRoute(
    permissions: string[],
    roles: string[] = [],
) {
    if (roles.some((role) => role.toLowerCase() === "platformadmin")) return "/platform/tenants";
    const set = new Set(permissions);
    if (set.has(Permissions.DashboardView)) return "/dashboard";
    if (set.has(Permissions.ProductsView)) return "/products";
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
    if (set.has(Permissions.TenantReportsView)) return "/reports";
    if (set.has(Permissions.TenantProfileManage)) return "/company";
    if (set.has(Permissions.SystemManage)) return "/system/general-types";
    return "/dashboard";
}
