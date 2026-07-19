namespace ECommerce.Shared;

public static class AuthClaims
{
    public const string CustomerId = "customer_id";
    public const string CustomerTypeId = "customer_type_id";
    public const string Permission = "permission";
}

public static class AppRoles
{
    public const string Admin = "Admin";
    public const string Customer = "Customer";
}

public static class AppPermissions
{
    public const string DashboardView = "dashboard.view";

    public const string ProductsView = "products.view";
    public const string ProductsManage = "products.manage";
    public const string ProductPricingManage = "product-pricing.manage";

    public const string InventoryView = "inventory.view";
    public const string InventoryManage = "inventory.manage";

    public const string OrdersView = "orders.view";
    public const string OrdersManage = "orders.manage";
    public const string PaymentsManage = "payments.manage";

    public const string CustomersView = "customers.view";
    public const string CustomersManage = "customers.manage";

    public const string UsersView = "users.view";
    public const string UsersManage = "users.manage";
    public const string RolesManage = "roles.manage";

    public const string SystemManage = "system.manage";

    public static readonly IReadOnlyCollection<string> All =
    [
        DashboardView,
        ProductsView,
        ProductsManage,
        ProductPricingManage,
        InventoryView,
        InventoryManage,
        OrdersView,
        OrdersManage,
        PaymentsManage,
        CustomersView,
        CustomersManage,
        UsersView,
        UsersManage,
        RolesManage,
        SystemManage
    ];

    public static readonly IReadOnlyDictionary<string, IReadOnlyCollection<PermissionDefinition>> Groups =
        new Dictionary<string, IReadOnlyCollection<PermissionDefinition>>
        {
            ["Dashboard"] =
            [
                new(DashboardView, "View dashboard", "View business, sales, traffic, and inventory analytics.")
            ],
            ["Catalog"] =
            [
                new(ProductsView, "View products", "View products and product details."),
                new(ProductsManage, "Manage products", "Create, update, activate, and delete products."),
                new(ProductPricingManage, "Manage pricing", "Manage default and customer-type prices.")
            ],
            ["Inventory"] =
            [
                new(InventoryView, "View inventory", "View stock levels and inventory transactions."),
                new(InventoryManage, "Manage inventory", "Adjust stock, reservations, and inventory settings.")
            ],
            ["Sales"] =
            [
                new(OrdersView, "View orders", "View order lists and order details."),
                new(OrdersManage, "Manage orders", "Confirm, process, deliver, and cancel orders."),
                new(PaymentsManage, "Manage payments", "Verify or reject offline payments.")
            ],
            ["Customers"] =
            [
                new(CustomersView, "View customers", "View customers, addresses, and order history."),
                new(CustomersManage, "Manage customers", "Create, edit, delete, and assign customer types.")
            ],
            ["Administration"] =
            [
                new(UsersView, "View users", "View administrator and staff accounts."),
                new(UsersManage, "Manage users", "Create, edit, activate, and reset user passwords."),
                new(RolesManage, "Manage roles and permissions", "Create roles and assign permission claims."),
                new(SystemManage, "Manage system settings", "Manage general types and system-level configuration.")
            ]
        };
}

public sealed record PermissionDefinition(string Value, string Name, string Description);
