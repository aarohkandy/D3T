import type { PropsWithChildren } from "react";

import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={cn(
        "rounded-[30px] border border-[color:var(--color-line-strong)] bg-[color:var(--color-panel)] p-6 shadow-[0_26px_90px_rgba(86,63,42,0.14)] backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </div>
  );
}
