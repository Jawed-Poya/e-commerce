import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { imageUrl } from "../../shared/api/api-client";
import { Button } from "../../shared/components/ui/button";
import { useCart } from "./cart-context";
export function CartPage() {
  const cart = useCart();
  const subtotal = cart.items.reduce((s, x) => s + x.price * x.quantity, 0);
  const shipping = subtotal >= 75 || !subtotal ? 0 : 7.5;
  if (!cart.items.length)
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <span className="mx-auto grid size-20 place-items-center rounded-full bg-secondary text-primary">
          <ShoppingBag className="size-8" />
        </span>
        <h1 className="mt-7 text-4xl font-black">Your cart is waiting.</h1>
        <p className="mt-4 leading-7 text-muted-foreground">
          Browse real products from the catalog. Your selections stay here when
          you return.
        </p>
        <Button asChild size="lg" className="mt-7">
          <Link to="/products">
            Explore products
            <ArrowRight />
          </Link>
        </Button>
      </div>
    );
  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-primary">
        Review your order
      </p>
      <h1 className="mt-3 text-4xl font-black sm:text-5xl">Shopping cart</h1>
      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_360px]">
        <div className="divide-y border-y">
          {cart.items.map((x) => (
            <article
              className="grid grid-cols-[90px_1fr] gap-4 py-5 sm:grid-cols-[110px_1fr_auto]"
              key={x.id}
            >
              <Link to={`/products/${x.id}`}>
                <img
                  className="aspect-square size-full rounded-md bg-muted object-cover"
                  src={imageUrl(x.image) || "/placeholder-product.svg"}
                  alt={x.name}
                />
              </Link>
              <div>
                <Link
                  className="font-bold hover:text-primary"
                  to={`/products/${x.id}`}
                >
                  {x.name}
                </Link>
                <p className="mt-1 text-sm text-muted-foreground">
                  ${x.price.toFixed(2)} each
                </p>
                <div className="mt-4 inline-flex rounded-md border">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    disabled={x.quantity <= 1}
                    onClick={() => cart.updateQuantity(x.id, x.quantity - 1)}
                  >
                    <Minus />
                  </Button>
                  <span className="grid size-8 place-items-center text-sm font-bold">
                    {x.quantity}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    disabled={x.quantity >= x.stock}
                    onClick={() => cart.updateQuantity(x.id, x.quantity + 1)}
                  >
                    <Plus />
                  </Button>
                </div>
              </div>
              <div className="col-start-2 flex items-center justify-between sm:col-start-3 sm:block sm:text-right">
                <b className="text-lg">${(x.price * x.quantity).toFixed(2)}</b>
                <Button
                  variant="ghost"
                  size="sm"
                  className="sm:mt-2 text-destructive"
                  onClick={() => cart.removeItem(x.id)}
                >
                  <Trash2 />
                  Remove
                </Button>
              </div>
            </article>
          ))}
        </div>
        <aside className="h-max rounded-lg border bg-card p-6 shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">
            Order summary
          </p>
          <h2 className="mt-2 text-3xl font-black">
            ${(subtotal + shipping).toFixed(2)}
          </h2>
          <div className="mt-6 grid gap-4 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <b className="text-foreground">${subtotal.toFixed(2)}</b>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Delivery</span>
              <b className="text-foreground">
                {shipping ? `$${shipping.toFixed(2)}` : "Free"}
              </b>
            </div>
            <div className="flex justify-between border-t pt-4 text-base font-bold">
              <span>Total</span>
              <span>${(subtotal + shipping).toFixed(2)}</span>
            </div>
          </div>
          <Button className="mt-6 w-full" size="lg">
            Continue to checkout
            <ArrowRight />
          </Button>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Taxes and delivery details are confirmed at checkout.
          </p>
        </aside>
      </div>
    </div>
  );
}
