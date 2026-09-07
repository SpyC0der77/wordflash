import { Suspense } from "react";
import { NuqsAdapter } from "nuqs/adapters/next/app";

export default function ReaderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={null}>
      <NuqsAdapter>{children}</NuqsAdapter>
    </Suspense>
  );
}
