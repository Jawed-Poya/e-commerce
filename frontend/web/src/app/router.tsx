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
      {
        path: "wishlist",
        lazy: async () => ({
          Component: (await import("../features/cart/wishlist-page"))
            .WishlistPage,
        }),
      },
      {
        path: "checkout",
        lazy: async () => ({
          Component: (await import("../features/checkout/checkout-page"))
            .CheckoutPage,
        }),
      },
      {
        path: "orders/:orderNumber/success",
        lazy: async () => ({
          Component: (await import("../features/orders/order-success-page"))
            .OrderSuccessPage,
        }),
      },
      {
        path: "track-order",
        lazy: async () => ({
          Component: (await import("../features/orders/order-tracking-page"))
            .OrderTrackingPage,
        }),
      },
      {
        path: "account/login",
        lazy: async () => ({
          Component: (await import("../features/auth/auth-page")).AuthPage,
        }),
      },
      {
        path: "account",
        lazy: async () => ({
          Component: (await import("../features/account/account-page"))
            .AccountPage,
        }),
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
