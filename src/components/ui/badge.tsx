import { cn } from "@/lib/utils";

export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-[color:var(--color-line-soft)] bg-[color:var(--color-panel-soft)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--color-ink-muted)]",
        className,
      )}
    >
      {children}
    </span>
  );
}
