import { createBrowserRouter } from "react-router-dom";
import AppLayout from "@/layouts/app-layout";
import Dashboard from "@/pages/dashboard";
import ProductsPage from "@/pages/products";

export const router = createBrowserRouter([
    {
        path: "/",
        element: <AppLayout />,

        children: [
            {
                index: true,
                element: <Dashboard />,
            },

            {
                path: "dashboard",
                element: <Dashboard />,
            },

            {
                path: "products",
                children: [
                    {
                        index: true,
                        element: <ProductsPage />,
                    },

                    {
                        path: "create",
                        element: "Create Product",
                    },

                    {
                        path: ":id/edit",
                        element: "Edit Product",
                    },
                ],
            },

            {
                path: "orders",
                element: "Orders",
            },

            {
                path: "customers",
                element: "Customers page",
            },

            {
                path: "settings",
                element: "Settings page",
            },
        ],
    },
]);
