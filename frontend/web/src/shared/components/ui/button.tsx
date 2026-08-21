import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-transparent text-sm font-bold transition-[background-color,border-color,color,transform] duration-200 disabled:pointer-events-none disabled:opacity-45 active:translate-y-px [&_svg]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-none hover:bg-primary/92",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/75",
        outline: "border-border/90 bg-background shadow-none hover:border-primary/30 hover:bg-muted/70 dark:border-white/[0.10] dark:bg-transparent",
        ghost: "hover:bg-muted",
        orange: "bg-brand-orange text-white shadow-none hover:bg-brand-orange/90",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
      },
      size: {
        default: "h-9 px-3.5",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-5",
        icon: "size-9 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
type Props = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };
export function Button({ className, variant, size, asChild, ...props }: Props) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
