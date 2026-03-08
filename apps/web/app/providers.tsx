"use client";

import { Toaster } from "@/components/ui/sonner";
import { ReaderSettingsProvider } from "@/lib/reader-settings-context";
import { ReduceMotionProvider } from "@/lib/reduce-motion-context";
import { ReduceTransparencyProvider } from "@/lib/reduce-transparency-context";
import { ThemeProvider } from "@/lib/theme-context";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <ReduceTransparencyProvider>
          <ReduceMotionProvider>
            <ReaderSettingsProvider>{children}</ReaderSettingsProvider>
          </ReduceMotionProvider>
        </ReduceTransparencyProvider>
      </TooltipProvider>
      <Toaster />
    </ThemeProvider>
  );
}
