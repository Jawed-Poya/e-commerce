import { useEffect, useLayoutEffect } from "react";
import {
  createBrowserRouter,
  Outlet,
  useLocation,
  type RouteObject,
} from "react-router-dom";
import { StoreLayout } from "../shared/layout/store-layout";
import { NotFoundPage } from "../shared/components/not-found-page";
import { OfflineBanner } from "../shared/components/navigation/offline-banner";
import { RouteProgress } from "../shared/components/navigation/route-progress";

function ScrollToTop() {
  const location = useLocation();

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  useLayoutEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [location.key]);

  return null;
}

function RouterShell() {
  return (
    <>
      <ScrollToTop />
      <RouteProgress />
      <OfflineBanner />
      <Outlet />
    </>
  );
}

const routes: RouteObject[] = [
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
        path: "account/reset-password",
        lazy: async () => ({
          Component: (await import("../features/auth/reset-password-page")).ResetPasswordPage,
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
];

export const router = createBrowserRouter([
  {
    element: <RouterShell />,
    children: routes,
  },
]);
