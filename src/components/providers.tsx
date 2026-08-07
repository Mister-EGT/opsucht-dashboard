"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { AccountProvider } from "@/components/account-provider";
import { FavoritesProvider } from "@/components/favorites-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/toast-provider";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            refetchOnWindowFocus: true,
            gcTime: 30 * 60_000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <AccountProvider>
            <FavoritesProvider>{children}</FavoritesProvider>
          </AccountProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
