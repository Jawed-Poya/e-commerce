import { createBrowserRouter } from 'react-router-dom'
import { StoreLayout } from '../shared/layout/store-layout'
import { HomePage } from '../features/home/home-page'
import { CatalogPage } from '../features/catalog/catalog-page'
import { ProductPage } from '../features/products/product-page'
import { CartPage } from '../features/cart/cart-page'
import { NotFoundPage } from '../shared/components/not-found-page'

export const router = createBrowserRouter([{ path: '/', element: <StoreLayout />, children: [
  { index: true, element: <HomePage /> },
  { path: 'products', element: <CatalogPage /> },
  { path: 'products/:id', element: <ProductPage /> },
  { path: 'cart', element: <CartPage /> },
  { path: '*', element: <NotFoundPage /> },
] }])
