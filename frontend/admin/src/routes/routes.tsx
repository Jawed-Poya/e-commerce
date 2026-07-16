import { createBrowserRouter } from "react-router-dom";
import AppLayout from "@/layouts/app-layout";
import Dashboard from "@/pages/dashboard";
import ProductsPage from "@/pages/products";
import CreateProductPage from "@/features/products/pages/create-product";
import GeneralTypesPage from "@/pages/general-types";
import { ProductBulkCreatePage } from "@/features/products/components/product-bulk-create-page";

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
                        path: "new",
                        element: <ProductBulkCreatePage />,
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
                path: "system/general-types",
                element: <GeneralTypesPage />,
            },

            {
                path: "settings",
                element: "Settings page",
            },
        ],
    },
]);
