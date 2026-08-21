import { Minus, Plus } from "lucide-react";
import { useEffect, useState, type KeyboardEvent } from "react";

import { useI18n } from "../../i18n/i18n-provider";
import { Badge } from "../../shared/components/ui/badge";
import { Button } from "../../shared/components/ui/button";
import { cn } from "../../shared/lib/utils";
import {
  cartQuantityStep,
  cartQuickQuantities,
  maximumCartQuantity,
  minimumCartQuantity,
  normalizeCartQuantity,
  useCart,
  type CartItem,
} from "./cart-context";

type CartQuantityControlProps = {
  item: CartItem;
  compact?: boolean;
  className?: string;
  showStepBadge?: boolean;
  showQuickQuantities?: boolean;
  variant?: "default" | "productCard";
  quickQuantityLimit?: number;
};

export function CartQuantityControl({
  item,
  compact = false,
  className,
  showStepBadge = true,
  showQuickQuantities = true,
  variant = "default",
  quickQuantityLimit,
}: CartQuantityControlProps) {
  const cart = useCart();
  const { t, formatNumber } = useI18n();
  const step = cartQuantityStep(item);
  const minimum = minimumCartQuantity(item);
  const maximum = maximumCartQuantity(item);
  const canIncrease = item.quantity + step <= maximum + Number.EPSILON;
  const allPresets = cartQuickQuantities(item);
  const presets = quickQuantityLimit == null
    ? allPresets
    : allPresets.slice(0, quickQuantityLimit);
  const isProductCard = variant === "productCard";

  const decrease = () => {
    if (item.quantity <= minimum + Number.EPSILON) {
      cart.removeItem(item.lineKey);
      return;
    }
    cart.updateQuantity(item.lineKey, item.quantity - step, item);
  };

  const increase = () => {
    if (!canIncrease) return;
    cart.updateQuantity(item.lineKey, item.quantity + step, item);
  };

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1.5",
        className,
      )}
    >
      {isProductCard ? (
        <div className="flex min-w-0 items-center justify-between gap-2">
          <p className="truncate text-[9px] font-black uppercase tracking-[0.12em] text-primary">
            {t("product.inCart")}
          </p>
          {showStepBadge && step > 1 ? (
            <Badge className="shrink-0 border border-primary/15 bg-primary/[0.06] px-2 text-[9px] font-black text-primary shadow-none">
              {t("cart.quantityStep", { count: formatNumber(step) })}
            </Badge>
          ) : null}
        </div>
      ) : null}

      <div className={cn("flex min-w-0 items-center", isProductCard ? "w-full" : "gap-1.5")}>
        <div
          className={cn(
            "min-w-0 overflow-hidden border border-primary/20 bg-background",
            isProductCard
              ? "grid h-9 w-full grid-cols-[2.25rem_minmax(0,1fr)_2.25rem] rounded-lg"
              : cn("inline-flex items-center rounded-lg", compact ? "h-8" : "h-11"),
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={decrease}
            className={cn(
              "shrink-0 rounded-none text-primary hover:bg-primary/10 hover:text-primary",
              isProductCard ? "size-9" : compact ? "size-8" : "size-11",
            )}
            aria-label={t("cart.decreaseQuantity")}
          >
            <Minus className={compact && !isProductCard ? "size-3.5" : "size-4"} />
          </Button>

          <QuantityInput
            item={item}
            compact={compact}
            stretch={isProductCard}
            onChange={(quantity) => cart.updateQuantity(item.lineKey, quantity, item)}
          />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={!canIncrease}
            onClick={increase}
            className={cn(
              "shrink-0 rounded-none text-primary hover:bg-primary/10 hover:text-primary disabled:text-muted-foreground",
              isProductCard ? "size-9" : compact ? "size-8" : "size-11",
            )}
            aria-label={t("cart.increaseQuantity")}
          >
            <Plus className={compact && !isProductCard ? "size-3.5" : "size-4"} />
          </Button>
        </div>

        {!isProductCard && showStepBadge && step > 1 ? (
          <Badge
            className={cn(
              "shrink-0 border border-primary/15 bg-primary/[0.06] font-black text-primary shadow-none",
              compact ? "h-6 px-1.5 text-[9px]" : "h-7 px-2 text-[10px]",
            )}
          >
            {t("cart.quantityStep", { count: formatNumber(step) })}
          </Badge>
        ) : null}
      </div>

      {showQuickQuantities && presets.length > 0 ? (
        <div
          className={cn(
            "max-w-full items-center gap-1",
            isProductCard
              ? "grid grid-cols-4"
              : "flex flex-nowrap overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          )}
        >
          {presets.map((quantity) => {
            const selected = Math.abs(item.quantity - quantity) < Number.EPSILON;
            return (
              <button
                key={quantity}
                type="button"
                onClick={() => cart.updateQuantity(item.lineKey, quantity, item)}
                aria-label={t("cart.setQuickQuantity", { count: formatNumber(quantity) })}
                className={cn(
                  "inline-flex shrink-0 items-center justify-center border font-black tabular-nums transition",
                  isProductCard
                    ? "h-6 min-w-0 rounded-md px-1 text-[9px]"
                    : "h-6 min-w-8 rounded-full px-2 text-[10px]",
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

function QuantityInput({
  item,
  compact,
  stretch,
  onChange,
}: {
  item: CartItem;
  compact: boolean;
  stretch: boolean;
  onChange: (quantity: number) => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(String(item.quantity));

  useEffect(() => {
    setDraft(String(item.quantity));
  }, [item.quantity]);

  const commit = () => {
    const parsed = Number(draft.replace(",", "."));
    if (!Number.isFinite(parsed)) {
      setDraft(String(item.quantity));
      return;
    }

    const normalized = normalizeCartQuantity(item, parsed);
    onChange(normalized);
    setDraft(String(normalized));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      setDraft(String(item.quantity));
      event.currentTarget.blur();
    }
  };

  return (
    <input
      type="number"
      inputMode="decimal"
      min={minimumCartQuantity(item)}
      max={maximumCartQuantity(item)}
      step="any"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      aria-label={t("cart.quantityInput", { name: item.name })}
      className={cn(
        "min-w-0 border-x border-primary/15 bg-primary/[0.035] text-center font-black tabular-nums text-foreground outline-none transition [appearance:textfield] focus:bg-primary/[0.08] focus:ring-2 focus:ring-inset focus:ring-primary/25 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        stretch
          ? "h-9 w-full px-2 text-xs"
          : compact
            ? "h-8 w-14 px-1 text-[11px]"
            : "h-11 w-20 px-2 text-sm",
      )}
    />
  );
}
