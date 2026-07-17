import { createBrowserRouter } from "react-router-dom";
import { StoreLayout } from "../shared/layout/store-layout";
import { NotFoundPage } from "../shared/components/not-found-page";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <StoreLayout />,
    children: [
      {
        index: true,
        lazy: async () => ({
          Component: (await import("../features/home/home-page")).HomePage,
        }),
      },
      {
        path: "products",
        lazy: async () => ({
          Component: (await import("../features/catalog/catalog-page"))
            .CatalogPage,
        }),
      },
      {
        path: "products/:id",
        lazy: async () => ({
          Component: (await import("../features/products/product-page"))
            .ProductPage,
        }),
      },
      {
        path: "cart",
        lazy: async () => ({
          Component: (await import("../features/cart/cart-page")).CartPage,
        }),
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
