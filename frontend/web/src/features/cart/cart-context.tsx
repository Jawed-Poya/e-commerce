import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface CartProduct {
  id: number;
  slug?: string | null;
  name: string;
  image?: string | null;
  price: number;
  stock: number;
  minimumValue?: number | null;
  maximumValue?: number | null;
}

export interface CartItem extends CartProduct {
  quantity: number;
}

interface CartValue {
  items: CartItem[];
  wishlist: number[];
  count: number;
  addItem: (product: CartProduct) => void;
  updateQuantity: (id: number, quantity: number) => void;
  removeItem: (id: number) => void;
  clear: () => void;
  toggleWishlist: (id: number) => void;
  clearWishlist: () => void;
}

const CartContext = createContext<CartValue | null>(null);

function readStorage<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "") as T;
  } catch {
    return fallback;
  }
}

type QuantityLimitedProduct = Pick<CartProduct, "stock" | "minimumValue" | "maximumValue">;

export function minimumCartQuantity(product: QuantityLimitedProduct) {
  return product.minimumValue != null && product.minimumValue > 0
    ? product.minimumValue
    : 1;
}

export function maximumCartQuantity(product: QuantityLimitedProduct) {
  const stock = Math.max(0, product.stock);
  if (product.maximumValue == null || product.maximumValue <= 0) return stock;
  return Math.min(stock, product.maximumValue);
}

export function cartQuantityStep(product: QuantityLimitedProduct) {
  const minimum = minimumCartQuantity(product);
  return minimum < 1 ? minimum : 1;
}

function clampQuantity(product: CartProduct, quantity: number) {
  const minimum = minimumCartQuantity(product);
  const maximum = maximumCartQuantity(product);
  if (maximum < minimum) return 0;
  return Math.min(maximum, Math.max(minimum, quantity));
}

function sameNumberArray(left: number[], right: number[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() =>
    readStorage<CartItem[]>("store-cart", []).map((item) => ({
      ...item,
      quantity: clampQuantity(item, item.quantity),
    })).filter((item) => item.quantity > 0),
  );
  const [wishlist, setWishlist] = useState<number[]>(() =>
    readStorage("store-wishlist", []),
  );

  useEffect(
    () => localStorage.setItem("store-cart", JSON.stringify(items)),
    [items],
  );
  useEffect(
    () => localStorage.setItem("store-wishlist", JSON.stringify(wishlist)),
    [wishlist],
  );

  const value = useMemo<CartValue>(
    () => ({
      items,
      wishlist,
      count: items.reduce((sum, item) => sum + item.quantity, 0),
      addItem: (product) =>
        setItems((current) => {
          const minimum = minimumCartQuantity(product);
          const maximum = maximumCartQuantity(product);
          if (maximum < minimum) return current;

          const found = current.find((item) => item.id === product.id);
          if (found) {
            const quantity = clampQuantity(
              product,
              found.quantity + cartQuantityStep(product),
            );
            return current.map((item) =>
              item.id === product.id
                ? { ...item, ...product, quantity }
                : item,
            );
          }

          return [...current, { ...product, quantity: minimum }];
        }),
      updateQuantity: (id, quantity) =>
        setItems((current) =>
          current.map((item) =>
            item.id === id
              ? { ...item, quantity: clampQuantity(item, quantity) }
              : item,
          ).filter((item) => item.quantity > 0),
        ),
      removeItem: (id) =>
        setItems((current) => current.filter((item) => item.id !== id)),
      clear: () => setItems([]),
      toggleWishlist: (id) =>
        setWishlist((current) => {
          const next = current.includes(id)
            ? current.filter((value) => value !== id)
            : [...current, id];
          return sameNumberArray(current, next) ? current : next;
        }),
      clearWishlist: () => setWishlist([]),
    }),
    [items, wishlist],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside CartProvider");
  return value;
}
