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

export function getDefaultAdminRoute(permissions: string[]) {
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
