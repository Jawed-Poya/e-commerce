import { Minus, Plus } from "lucide-react";

import { useI18n } from "../../i18n/i18n-provider";
import { Badge } from "../../shared/components/ui/badge";
import { Button } from "../../shared/components/ui/button";
import { cn } from "../../shared/lib/utils";
import {
  cartQuantityStep,
  cartQuickQuantities,
  maximumCartQuantity,
  minimumCartQuantity,
  useCart,
  type CartItem,
} from "./cart-context";

type CartQuantityControlProps = {
  item: CartItem;
  compact?: boolean;
  className?: string;
  showStepBadge?: boolean;
  showQuickQuantities?: boolean;
};

export function CartQuantityControl({
  item,
  compact = false,
  className,
  showStepBadge = true,
  showQuickQuantities,
}: CartQuantityControlProps) {
  const cart = useCart();
  const { t, formatNumber } = useI18n();
  const step = cartQuantityStep(item);
  const minimum = minimumCartQuantity(item);
  const maximum = maximumCartQuantity(item);
  const canIncrease = item.quantity + step <= maximum + Number.EPSILON;
  const presets = cartQuickQuantities(item);
  const shouldShowQuickQuantities = showQuickQuantities ?? !compact;

  const decrease = () => {
    if (item.quantity <= minimum + Number.EPSILON) {
      cart.removeItem(item.lineKey);
      return;
    }

    cart.updateQuantity(item.lineKey, item.quantity - step);
  };

  const increase = () => {
    if (!canIncrease) return;
    cart.updateQuantity(item.lineKey, item.quantity + step);
  };

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div className="flex min-w-0 items-center gap-1.5">
        <div
          className={cn(
            "inline-flex items-center overflow-hidden rounded-lg border border-primary/20 bg-background shadow-sm",
            compact ? "h-8" : "h-11",
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={decrease}
            className={cn(
              "shrink-0 rounded-none text-primary hover:bg-primary/10 hover:text-primary",
              compact ? "size-8" : "size-11",
            )}
            aria-label={t("cart.decreaseQuantity")}
          >
            <Minus className={compact ? "size-3.5" : "size-4"} />
          </Button>

          <span
            className={cn(
              "grid min-w-10 place-items-center border-x border-primary/15 bg-primary/[0.055] px-2 font-black tabular-nums text-foreground",
              compact ? "h-8 text-[11px]" : "h-11 min-w-12 text-sm",
            )}
            aria-label={t("cart.currentQuantity", { count: item.quantity })}
          >
            {formatNumber(item.quantity)}
          </span>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={!canIncrease}
            onClick={increase}
            className={cn(
              "shrink-0 rounded-none text-primary hover:bg-primary/10 hover:text-primary disabled:text-muted-foreground",
              compact ? "size-8" : "size-11",
            )}
            aria-label={t("cart.increaseQuantity")}
          >
            <Plus className={compact ? "size-3.5" : "size-4"} />
          </Button>
        </div>

        {showStepBadge && step > 1 ? (
          <Badge
            variant="secondary"
            className={cn(
              "shrink-0 border border-primary/15 bg-primary/[0.06] font-black text-primary shadow-none",
              compact ? "h-6 px-1.5 text-[9px]" : "h-7 px-2 text-[10px]",
            )}
          >
            {t("cart.quantityStep", { count: formatNumber(step) })}
          </Badge>
        ) : null}
      </div>

      {shouldShowQuickQuantities && presets.length > 0 ? (
        <div className="flex max-w-full flex-wrap items-center gap-1">
          {presets.map((quantity) => {
            const selected = Math.abs(item.quantity - quantity) < Number.EPSILON;
            return (
              <button
                key={quantity}
                type="button"
                onClick={() => cart.updateQuantity(item.lineKey, quantity)}
                aria-label={t("cart.setQuickQuantity", { count: formatNumber(quantity) })}
                className={cn(
                  "inline-flex h-6 min-w-8 items-center justify-center rounded-full border px-2 text-[10px] font-black tabular-nums transition",
                  selected
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-primary/15 bg-primary/[0.045] text-primary hover:border-primary/30 hover:bg-primary/[0.09]",
                )}
              >
                {formatNumber(quantity)}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
