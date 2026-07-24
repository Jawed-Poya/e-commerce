import { createBrowserRouter } from "react-router-dom";
import AppLayout from "@/layouts/app-layout";
import Dashboard from "@/pages/dashboard";
import ProductsPage from "@/pages/products";
import GeneralTypesPage from "@/pages/general-types";
import { ProductBulkCreatePage } from "@/features/products/components/product-bulk-create-page";
import { ProductEditorPage } from "@/features/products/components/product-editor-page";
import ProductDetailsPage from "@/pages/product-details";
import { InventoryPage } from "@/features/inventory/components/inventory-page";
import OrdersPage from "@/pages/orders";
import OrderDetailsPage from "@/pages/order-details";
import CustomersPage from "@/pages/customers";
import CustomerDetailsPage from "@/pages/customer-details";
import UsersPage from "@/pages/users";
import RolesPage from "@/pages/roles";
import AdminLoginPage from "@/features/auth/login-page";
import ProfilePage from "@/pages/profile";
import AdminNotFoundPage from "@/pages/not-found";
import StorefrontContentPage from "@/pages/storefront-content";
import ReviewsPage from "@/pages/reviews";
import OperationsDashboardPage from "@/pages/operations-dashboard";
import PurchasesPage from "@/pages/purchases";
import ManualSalesPage from "@/pages/manual-sales";
import StaffPage from "@/pages/staff";
import ExpensesPage from "@/pages/expenses";
import CompanySettingsPage from "@/pages/company-settings";
import TenantReportsPage from "@/pages/tenant-reports";
import TrashPage from "@/pages/trash";
import PlatformTenantsPage from "@/pages/platform-tenants";
import PlatformSettingsPage from "@/pages/platform-settings";
import SubscriptionPlansPage from "@/pages/subscription-plans";

import { ProtectedRoute } from "@/features/auth/protected-route";
import { PermissionRoute } from "@/features/auth/permission-route";
import { Permissions } from "@/features/auth/permissions";

const allowed = (permission: string, element: React.ReactNode) => (
    <PermissionRoute permission={permission}>{element}</PermissionRoute>
);

export const router = createBrowserRouter([
    {
        path: "/login",
        element: <AdminLoginPage />,
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
                        element: allowed(Permissions.DashboardView, <Dashboard />),
                    },
                    {
                        path: "dashboard",
                        element: allowed(Permissions.DashboardView, <Dashboard />),
                    },
                    {
                        path: "products",
                        children: [
                            {
                                index: true,
                                element: allowed(
                                    Permissions.ProductsView,
                                    <ProductsPage />,
                                ),
                            },
                            {
                                path: "new",
                                element: allowed(
                                    Permissions.ProductsManage,
                                    <ProductEditorPage />,
                                ),
                            },
                            {
                                path: "bulk",
                                element: allowed(
                                    Permissions.ProductsManage,
                                    <ProductBulkCreatePage />,
                                ),
                            },
                            {
                                path: ":id",
                                element: allowed(
                                    Permissions.ProductsView,
                                    <ProductDetailsPage />,
                                ),
                            },
                            {
                                path: ":id/edit",
                                element: allowed(
                                    Permissions.ProductsManage,
                                    <ProductEditorPage />,
                                ),
                            },
                        ],
                    },
                    {
                        path: "reviews",
                        element: allowed(
                            Permissions.ProductsManage,
                            <ReviewsPage />,
                        ),
                    },
                    {
                        path: "inventory",
                        element: allowed(
                            Permissions.InventoryView,
                            <InventoryPage />,
                        ),
                    },
                    {
                        path: "operations",
                        children: [
                            { index: true, element: allowed(Permissions.OperationsView, <OperationsDashboardPage />) },
                            { path: "purchases", element: allowed(Permissions.PurchasesView, <PurchasesPage />) },
                            { path: "sales", element: allowed(Permissions.ManualSalesView, <ManualSalesPage />) },
                            { path: "staff", element: allowed(Permissions.StaffView, <StaffPage />) },
                            { path: "expenses", element: allowed(Permissions.ExpensesView, <ExpensesPage />) },
                        ],
                    },
                    {
                        path: "orders",
                        children: [
                            {
                                index: true,
                                element: allowed(
                                    Permissions.OrdersView,
                                    <OrdersPage />,
                                ),
                            },
                            {
                                path: ":id",
                                element: allowed(
                                    Permissions.OrdersView,
                                    <OrderDetailsPage />,
                                ),
                            },
                        ],
                    },
                    {
                        path: "customers",
                        children: [
                            {
                                index: true,
                                element: allowed(
                                    Permissions.CustomersView,
                                    <CustomersPage />,
                                ),
                            },
                            {
                                path: ":id",
                                element: allowed(
                                    Permissions.CustomersView,
                                    <CustomerDetailsPage />,
                                ),
                            },
                        ],
                    },
                    {
                        path: "profile",
                        element: <ProfilePage />,
                    },
                    {
                        path: "company",
                        element: allowed(Permissions.TenantProfileManage, <CompanySettingsPage />),
                    },
                    {
                        path: "reports",
                        element: allowed(Permissions.TenantReportsView, <TenantReportsPage />),
                    },
                    {
                        path: "trash",
                        element: allowed(Permissions.TenantTrashManage, <TrashPage />),
                    },
                    {
                        path: "platform/tenants",
                        element: allowed(Permissions.PlatformTenantsManage, <PlatformTenantsPage />),
                    },
                    {
                        path: "platform/plans",
                        element: allowed(Permissions.PlatformTenantsManage, <SubscriptionPlansPage />),
                    },
                    {
                        path: "platform/settings",
                        element: allowed(Permissions.PlatformTenantsManage, <PlatformSettingsPage />),
                    },
                    {
                        path: "system/general-types",
                        element: allowed(
                            Permissions.SystemManage,
                            <GeneralTypesPage />,
                        ),
                    },
                    {
                        path: "system/storefront",
                        element: allowed(
                            Permissions.SystemManage,
                            <StorefrontContentPage />,
                        ),
                    },
                    {
                        path: "system/users",
                        element: allowed(Permissions.UsersView, <UsersPage />),
                    },
                    {
                        path: "system/roles",
                        element: allowed(Permissions.RolesManage, <RolesPage />),
                    },
                    {
                        path: "*",
                        element: <AdminNotFoundPage />,
                    },
                ],
            },
        ],
    },
    {
        path: "*",
        element: <AdminNotFoundPage />,
    },
]);
