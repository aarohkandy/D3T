import { cva, type VariantProps } from "class-variance-authority";
import Link from "next/link";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-bg)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "border border-[rgba(58,42,28,0.2)] bg-[color:var(--color-accent)] px-5 py-3 text-[#fffaf3] shadow-[0_14px_32px_rgba(71,52,35,0.2)] hover:bg-[color:var(--color-accent-strong)]",
        secondary:
          "border border-[color:var(--color-line-soft)] bg-[rgba(255,252,247,0.96)] px-5 py-3 text-[color:var(--color-ink)] shadow-[0_10px_24px_rgba(80,58,36,0.08)] hover:border-[color:var(--color-line-strong)] hover:bg-[rgba(255,249,240,1)]",
        ghost:
          "px-4 py-2 text-[color:var(--color-ink-muted)] hover:bg-[rgba(78,61,49,0.08)] hover:text-[color:var(--color-ink)]",
        danger:
          "bg-[color:var(--color-danger)] px-5 py-3 text-white hover:bg-[#bb514d]",
      },
      size: {
        sm: "h-10 px-4",
        md: "h-11 px-5",
        lg: "h-12 px-6 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, size, variant, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

type ButtonLinkProps = React.ComponentProps<typeof Link> &
  VariantProps<typeof buttonVariants>;

export function ButtonLink({ className, size, variant, ...props }: ButtonLinkProps) {
  return (
    <Link
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
