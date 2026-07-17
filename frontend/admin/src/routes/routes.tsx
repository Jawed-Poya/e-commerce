import { createBrowserRouter } from "react-router-dom";
import AppLayout from "@/layouts/app-layout";
import Dashboard from "@/pages/dashboard";
import ProductsPage from "@/pages/products";
import GeneralTypesPage from "@/pages/general-types";
import { ProductBulkCreatePage } from "@/features/products/components/product-bulk-create-page";
import ProductDetailsPage from "@/pages/product-details";
import { InventoryPage } from "@/features/inventory/components/inventory-page";

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
                        path: ":id",
                        element: <ProductDetailsPage />,
                    },

                    {
                        path: ":id/edit",
                        element: "Edit Product",
                    },
                ],
            },

            {
                path: "inventory",
                element: <InventoryPage />,
            },

            {
                path: "system/general-types",
                element: <GeneralTypesPage />,
            },

        ],
    },
]);
