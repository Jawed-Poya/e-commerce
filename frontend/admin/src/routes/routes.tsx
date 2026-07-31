import type { ComponentType } from "react";
import { createBrowserRouter } from "react-router-dom";

import { PermissionRoute } from "@/features/auth/permission-route";
import { Permissions } from "@/features/auth/permissions";
import { ProtectedRoute } from "@/features/auth/protected-route";
import AppLayout from "@/layouts/app-layout";

function lazyPage(load: () => Promise<ComponentType>) {
    return async () => ({ Component: await load() });
}

function lazyAllowed(
    permission: string | readonly string[],
    load: () => Promise<ComponentType>,
) {
    return async () => {
        const Page = await load();
        return {
            Component: () => (
                <PermissionRoute permission={permission}>
                    <Page />
                </PermissionRoute>
            ),
        };
    };
}

const loadNotFound = () =>
    import("@/pages/not-found").then((module) => module.default);

export const router = createBrowserRouter([
    {
        path: "/login",
        lazy: lazyPage(() =>
            import("@/features/auth/login-page").then((module) => module.default),
        ),
    },
    {
        element: <ProtectedRoute />,
        children: [
            {
                path: "/",
                element: <AppLayout />,
                children: [
                    {
                        index: true,
                        lazy: lazyAllowed(Permissions.DashboardView, () =>
                            import("@/pages/dashboard").then((module) => module.default),
                        ),
                    },
                    {
                        path: "dashboard",
                        lazy: lazyAllowed(Permissions.DashboardView, () =>
                            import("@/pages/dashboard").then((module) => module.default),
                        ),
                    },
                    {
                        path: "products",
                        children: [
                            {
                                index: true,
                                lazy: lazyAllowed(Permissions.ProductsView, () =>
                                    import("@/pages/products").then((module) => module.default),
                                ),
                            },
                            {
                                path: "new",
                                lazy: lazyAllowed(Permissions.ProductsManage, () =>
                                    import("@/features/products/components/product-editor-page")
                                        .then((module) => module.ProductEditorPage),
                                ),
                            },
                            {
                                path: "bulk",
                                lazy: lazyAllowed(Permissions.ProductsManage, () =>
                                    import("@/features/products/components/product-bulk-create-page")
                                        .then((module) => module.ProductBulkCreatePage),
                                ),
                            },
                            {
                                path: ":id",
                                lazy: lazyAllowed(Permissions.ProductsView, () =>
                                    import("@/pages/product-details").then((module) => module.default),
                                ),
                            },
                            {
                                path: ":id/edit",
                                lazy: lazyAllowed(Permissions.ProductsManage, () =>
                                    import("@/features/products/components/product-editor-page")
                                        .then((module) => module.ProductEditorPage),
                                ),
                            },
                        ],
                    },
                    {
                        path: "reviews",
                        lazy: lazyAllowed(Permissions.ReviewsView, () =>
                            import("@/pages/reviews").then((module) => module.default),
                        ),
                    },
                    {
                        path: "inventory",
                        lazy: lazyAllowed(Permissions.InventoryView, () =>
                            import("@/features/inventory/components/inventory-page")
                                .then((module) => module.InventoryPage),
                        ),
                    },
                    {
                        path: "operations",
                        children: [
                            {
                                index: true,
                                lazy: lazyAllowed(Permissions.OperationsView, () =>
                                    import("@/pages/operations-dashboard")
                                        .then((module) => module.default),
                                ),
                            },
                            {
                                path: "purchases",
                                lazy: lazyAllowed(Permissions.PurchasesView, () =>
                                    import("@/pages/purchases").then((module) => module.default),
                                ),
                            },
                            {
                                path: "sales",
                                lazy: lazyAllowed(Permissions.ManualSalesView, () =>
                                    import("@/pages/manual-sales").then((module) => module.default),
                                ),
                            },
                            {
                                path: "staff",
                                lazy: lazyAllowed(Permissions.StaffView, () =>
                                    import("@/pages/staff").then((module) => module.default),
                                ),
                            },
                            {
                                path: "expenses",
                                lazy: lazyAllowed(Permissions.ExpensesView, () =>
                                    import("@/pages/expenses").then((module) => module.default),
                                ),
                            },
                        ],
                    },
                    {
                        path: "orders",
                        children: [
                            {
                                index: true,
                                lazy: lazyAllowed(Permissions.OrdersView, () =>
                                    import("@/features/orders/pages/orders-page")
                                        .then((module) => module.default),
                                ),
                            },
                            {
                                path: ":id",
                                lazy: lazyAllowed(Permissions.OrdersView, () =>
                                    import("@/features/orders/pages/order-details-page")
                                        .then((module) => module.default),
                                ),
                            },
                        ],
                    },
                    {
                        path: "customers",
                        children: [
                            {
                                index: true,
                                lazy: lazyAllowed(Permissions.CustomersView, () =>
                                    import("@/pages/customers").then((module) => module.default),
                                ),
                            },
                            {
                                path: ":id",
                                lazy: lazyAllowed(Permissions.CustomersView, () =>
                                    import("@/pages/customer-details")
                                        .then((module) => module.default),
                                ),
                            },
                        ],
                    },
                    {
                        path: "profile",
                        lazy: lazyPage(() =>
                            import("@/pages/profile").then((module) => module.default),
                        ),
                    },
                    {
                        path: "company",
                        lazy: lazyAllowed(
                            [
                                Permissions.CompanyProfileManage,
                                Permissions.CompanySettingsManage,
                                Permissions.CompanyBranchesManage,
                                Permissions.OperationLineLimitsManage,
                            ],
                            () => import("@/pages/company-settings").then((module) => module.default),
                        ),
                    },
                    {
                        path: "reports",
                        lazy: lazyAllowed(Permissions.FinancialReportsView, () =>
                            import("@/features/finance/pages/financial-reports-page")
                                .then((module) => module.default),
                        ),
                    },
                    {
                        path: "trash",
                        lazy: lazyAllowed(Permissions.CompanyTrashManage, () =>
                            import("@/pages/trash").then((module) => module.default),
                        ),
                    },
                    {
                        path: "audit",
                        lazy: lazyAllowed(Permissions.AuditLogsView, () =>
                            import("@/features/audit/audit-page").then((module) => module.default),
                        ),
                    },
                    {
                        path: "system/general-types",
                        lazy: lazyAllowed(Permissions.GeneralTypesManage, () =>
                            import("@/pages/general-types").then((module) => module.default),
                        ),
                    },
                    {
                        path: "system/storefront",
                        lazy: lazyAllowed(Permissions.StorefrontManage, () =>
                            import("@/pages/storefront-content")
                                .then((module) => module.default),
                        ),
                    },
                    {
                        path: "system/users",
                        lazy: lazyAllowed(Permissions.UsersView, () =>
                            import("@/pages/users").then((module) => module.default),
                        ),
                    },
                    {
                        path: "system/roles",
                        lazy: lazyAllowed(Permissions.RolesManage, () =>
                            import("@/pages/roles").then((module) => module.default),
                        ),
                    },
                    {
                        path: "*",
                        lazy: lazyPage(loadNotFound),
                    },
                ],
            },
        ],
    },
    {
        path: "*",
        lazy: lazyPage(loadNotFound),
    },
]);
