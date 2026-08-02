namespace ECommerce.Shared;

public static class AuthClaims
{
    public const string CustomerId = "customer_id";
    public const string CustomerTypeId = "customer_type_id";
    public const string Permission = "permission";
    public const string BranchId = "branch_id";
}

public static class AppRoles
{
    public const string Admin = "Admin";
    public const string Customer = "Customer";
    public const string StoreOperator = "Store Operator";
}

public static class AppPermissions
{
    public const string AdminNotificationsViewPolicy = "admin.notifications.view";

    public const string DashboardView = "dashboard.view";

    public const string ProductsView = "products.view";
    public const string ProductsManage = "products.manage";
    public const string ProductPricingManage = "product-pricing.manage";
    public const string ReviewsView = "reviews.view";
    public const string ReviewsManage = "reviews.manage";

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

    public const string OperationsView = "operations.view";
    public const string PurchasesView = "purchases.view";
    public const string PurchasesManage = "purchases.manage";
    public const string ManualSalesView = "manual-sales.view";
    public const string ManualSalesManage = "manual-sales.manage";
    public const string StaffView = "staff.view";
    public const string StaffManage = "staff.manage";
    public const string PayrollView = "payroll.view";
    public const string PayrollManage = "payroll.manage";
    public const string ExpensesView = "expenses.view";
    public const string ExpensesManage = "expenses.manage";
    public const string OperationLineLimitsManage = "operations.line-limits.manage";
    public const string OperationLineLimitsOverride = "operations.line-limits.override";

    public const string CompanyProfileManage = "company.profile.manage";
    public const string CompanyBranchesManage = "company.branches.manage";
    public const string CompanyClaimsManage = "company.claims.manage";
    public const string FinancialReportsView = "company.reports.view";
    public const string CompanyTrashManage = "company.trash.manage";
    public const string CompanySettingsManage = "company.settings.manage";
    public const string AuditLogsView = "company.audit-logs.view";
    public const string NotificationsManage = "company.notifications.manage";

    public const string GeneralTypesManage = "system.general-types.manage";
    public const string StorefrontManage = "system.storefront.manage";
    public const string SystemManage = "system.manage";

    public static readonly IReadOnlyCollection<string> All =
    [
        DashboardView,
        ProductsView,
        ProductsManage,
        ProductPricingManage,
        ReviewsView,
        ReviewsManage,
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
        OperationsView,
        PurchasesView,
        PurchasesManage,
        ManualSalesView,
        ManualSalesManage,
        StaffView,
        StaffManage,
        PayrollView,
        PayrollManage,
        ExpensesView,
        ExpensesManage,
        OperationLineLimitsManage,
        OperationLineLimitsOverride,
        CompanyProfileManage,
        CompanyBranchesManage,
        CompanyClaimsManage,
        FinancialReportsView,
        CompanyTrashManage,
        CompanySettingsManage,
        AuditLogsView,
        NotificationsManage,
        GeneralTypesManage,
        StorefrontManage,
        SystemManage
    ];


    public static readonly IReadOnlyDictionary<string, IReadOnlyCollection<string>> LegacyPermissionParents =
        new Dictionary<string, IReadOnlyCollection<string>>(StringComparer.Ordinal)
        {
            [ReviewsView] = [ProductsManage],
            [ReviewsManage] = [ProductsManage],
            [NotificationsManage] = [OrdersManage],
            [GeneralTypesManage] = [SystemManage],
            [StorefrontManage] = [SystemManage]
        };

    public static bool IsGranted(System.Security.Claims.ClaimsPrincipal user, string permission) =>
        user.IsInRole(AppRoles.Admin) ||
        user.HasClaim(AuthClaims.Permission, permission) ||
        (LegacyPermissionParents.TryGetValue(permission, out var parents) &&
         parents.Any(parent => user.HasClaim(AuthClaims.Permission, parent)));

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
                new(ProductPricingManage, "Manage pricing", "Manage default and customer-type prices."),
                new(ReviewsView, "View product reviews", "View customer product reviews and moderation status."),
                new(ReviewsManage, "Manage product reviews", "Approve, hide, and delete customer product reviews.")
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
            ["Operations"] =
            [
                new(OperationsView, "View operations", "View operational and financial summaries."),
                new(PurchasesView, "View purchases", "View suppliers and purchase receipts."),
                new(PurchasesManage, "Manage purchases", "Create suppliers and receive product purchases."),
                new(ManualSalesView, "View manual sales", "View point-of-sale and manual sales."),
                new(ManualSalesManage, "Manage manual sales", "Record sales and deduct available stock."),
                new(StaffView, "View staff", "View staff records."),
                new(StaffManage, "Manage staff", "Create, update, and remove staff records."),
                new(PayrollView, "View payroll", "View staff salary payments."),
                new(PayrollManage, "Manage payroll", "Record salary payments and adjustments."),
                new(ExpensesView, "View expenses", "View expense categories and transactions."),
                new(ExpensesManage, "Manage expenses", "Create expense categories and record expenses."),
                new(OperationLineLimitsManage, "Manage operation line limits", "Configure the maximum number of product lines allowed in purchases and manual sales."),
                new(OperationLineLimitsOverride, "Override operation line limits", "Create purchases and manual sales that exceed the configured line limits when business operations require it.")
            ],
            ["Company administration"] =
            [
                new(CompanyProfileManage, "Manage company profile", "Update the company profile and brand assets."),
                new(CompanyBranchesManage, "Manage branches", "Create and maintain company branches."),
                new(CompanyClaimsManage, "Manage user permissions", "Assign permissions that the current administrator is allowed to manage."),
                new(FinancialReportsView, "View financial reports", "View revenue, cost, profit, cash flow, ledgers, and company worth reports."),
                new(CompanyTrashManage, "Manage trash", "Restore or permanently purge company records."),
                new(CompanySettingsManage, "Manage company settings", "Configure currency, branding, fonts, and retention policies."),
                new(AuditLogsView, "View audit and visit logs", "Review administrator activity and storefront customer visits."),
                new(NotificationsManage, "Manage admin notifications", "Delete individual notifications or clear the company notification inbox.")
            ],
            ["Administration"] =
            [
                new(UsersView, "View users", "View administrator and staff accounts."),
                new(UsersManage, "Manage users", "Create, edit, activate, and reset user passwords."),
                new(RolesManage, "Manage roles and permissions", "Create roles and assign permission claims."),
                new(GeneralTypesManage, "Manage general types", "Create and maintain categories, brands, units, customer types, and reusable types."),
                new(StorefrontManage, "Manage storefront content", "Update storefront hero content and promotional media."),
                new(SystemManage, "Manage all system settings", "Legacy broad permission that also grants general-types and storefront management.")
            ]
        };
}

public sealed record PermissionDefinition(string Value, string Name, string Description);
