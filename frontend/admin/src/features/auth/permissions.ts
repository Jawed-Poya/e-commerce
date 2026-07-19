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
    SystemManage: "system.manage",
} as const;

export function isSystemAdministrator(
    user: Pick<AuthUser, "roles"> | null | undefined,
) {
    return (
        user?.roles.some((role) => role.toLowerCase() === "admin") ?? false
    );
}

export function hasPermission(
    user: Pick<AuthUser, "roles" | "permissions"> | null | undefined,
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
    if (roles.some((role) => role.toLowerCase() === "admin"))
        return "/dashboard";
    const set = new Set(permissions);
    if (set.has(Permissions.DashboardView)) return "/dashboard";
    if (set.has(Permissions.ProductsView)) return "/products";
    if (set.has(Permissions.InventoryView)) return "/inventory";
    if (set.has(Permissions.OrdersView)) return "/orders";
    if (set.has(Permissions.CustomersView)) return "/customers";
    if (set.has(Permissions.UsersView)) return "/system/users";
    if (set.has(Permissions.RolesManage)) return "/system/roles";
    if (set.has(Permissions.SystemManage)) return "/system/general-types";
    return "/dashboard";
}
