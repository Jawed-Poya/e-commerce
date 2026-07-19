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
  name: string;
  image?: string | null;
  price: number;
  stock: number;
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
}

const CartContext = createContext<CartValue | null>(null);

function readStorage<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "") as T;
  } catch {
    return fallback;
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() =>
    readStorage("store-cart", []),
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
          const found = current.find((item) => item.id === product.id);
          if (found)
            return current.map((item) =>
              item.id === product.id
                ? {
                    ...item,
                    quantity: Math.min(item.quantity + 1, item.stock || 99),
                  }
                : item,
            );
          return [...current, { ...product, quantity: 1 }];
        }),
      updateQuantity: (id, quantity) =>
        setItems((current) =>
          current.map((item) =>
            item.id === id
              ? {
                  ...item,
                  quantity: Math.max(1, Math.min(quantity, item.stock || 99)),
                }
              : item,
          ),
        ),
      removeItem: (id) =>
        setItems((current) => current.filter((item) => item.id !== id)),
      clear: () => setItems([]),
      toggleWishlist: (id) =>
        setWishlist((current) =>
          current.includes(id)
            ? current.filter((value) => value !== id)
            : [...current, id],
        ),
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
