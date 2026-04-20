"use client";

import { Toaster } from "sonner";

export function ClientProviders() {
  return (
    <Toaster
      position="top-right"
      richColors
      closeButton
      theme="light"
    />
  );
}
