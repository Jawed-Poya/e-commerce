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
import AdminLoginPage from "@/features/auth/login-page";
import { ProtectedRoute } from "@/features/auth/protected-route";

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
                    { index: true, element: <Dashboard /> },
                    { path: "dashboard", element: <Dashboard /> },
                    {
                        path: "products",
                        children: [
                            { index: true, element: <ProductsPage /> },
                            { path: "new", element: <ProductBulkCreatePage /> },
                            { path: ":id", element: <ProductDetailsPage /> },
                            { path: ":id/edit", element: "Edit Product" },
                        ],
                    },
                    { path: "inventory", element: <InventoryPage /> },
                    {
                        path: "orders",
                        children: [
                            { index: true, element: <OrdersPage /> },
                            { path: ":id", element: <OrderDetailsPage /> },
                        ],
                    },
                    {
                        path: "customers",
                        children: [
                            { index: true, element: <CustomersPage /> },
                            { path: ":id", element: <CustomerDetailsPage /> },
                        ],
                    },
                    { path: "system/general-types", element: <GeneralTypesPage /> },
                ],
            },
        ],
    },
]);
