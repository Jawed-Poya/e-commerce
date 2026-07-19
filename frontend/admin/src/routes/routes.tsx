import { createBrowserRouter } from "react-router-dom";
import AppLayout from "@/layouts/app-layout";
import Dashboard from "@/pages/dashboard";
import ProductsPage from "@/pages/products";
import GeneralTypesPage from "@/pages/general-types";
import { ProductBulkCreatePage } from "@/features/products/components/product-bulk-create-page";
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
                                    <>Edit Product</>,
                                ),
                            },
                        ],
                    },
                    {
                        path: "inventory",
                        element: allowed(
                            Permissions.InventoryView,
                            <InventoryPage />,
                        ),
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
                        path: "system/general-types",
                        element: allowed(
                            Permissions.SystemManage,
                            <GeneralTypesPage />,
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
