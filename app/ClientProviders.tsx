"use client";

import dynamic from "next/dynamic";
import { ReactNode } from "react";

const ConvexClientProvider = dynamic(
  () =>
    import("./ConvexClientProvider").then((mod) => mod.ConvexClientProvider),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-charcoal-soft">Loading...</p>
      </div>
    ),
  },
);

export function ClientProviders({ children }: { children: ReactNode }) {
  return <ConvexClientProvider>{children}</ConvexClientProvider>;
}
