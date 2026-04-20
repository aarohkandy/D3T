import { type ClassValue, clsx } from "clsx";
import { formatDistanceToNowStrict } from "date-fns";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(value: string | Date | null | undefined) {
  if (!value) {
    return "just now";
  }

  const date = value instanceof Date ? value : new Date(value);

  return `${formatDistanceToNowStrict(date, { addSuffix: true })}`;
}

export function titleCase(value: string) {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function assertNever(value: never): never {
  throw new Error(`Unhandled case: ${String(value)}`);
}
