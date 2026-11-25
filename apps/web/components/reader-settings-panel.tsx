"use client";

import { Settings } from "lucide-react";
import { Dialog } from "radix-ui";
import {
  ReaderSettingsContent,
  type ReaderSettingsContentProps,
} from "@/components/reader-settings-content";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useMediaQuery } from "@/hooks/use-media-query";
import { DIALOG_CONTENT_ANIMATION, dialogOverlayClassName } from "@/lib/dialog-styles";
import { useReaderSettings } from "@/lib/reader-settings-context";
import { useReduceMotion } from "@/lib/reduce-motion-context";
import { useReduceTransparency } from "@/lib/reduce-transparency-context";
import { useTheme } from "@/lib/theme-context";
import { cn } from "@/lib/utils";

const DESCRIPTION =
  "Appearance, playback, and accessibility. Pause values are at 250 WPM and scale with speed.";

interface ReaderSettingsPanelProps
  extends Partial<Omit<ReaderSettingsContentProps, "idPrefix">> {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerClassName?: string;
}

/**
 * Settings trigger plus a centered dialog on desktop or a bottom drawer on mobile.
 * Values come from the settings contexts; any content prop passed here overrides them.
 */
export function ReaderSettingsPanel({
  title,
  open,
  onOpenChange,
  triggerClassName,
  ...overrides
}: ReaderSettingsPanelProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const { resetDefaults, ...settings } = useReaderSettings();
  const { theme, setTheme } = useTheme();
  const { reduceMotion, setReduceMotion } = useReduceMotion();
  const { reduceTransparency, setReduceTransparency } = useReduceTransparency();
  const contentProps: Omit<ReaderSettingsContentProps, "idPrefix"> = {
    ...settings,
    theme,
    setTheme,
    reduceMotion,
    setReduceMotion,
    reduceTransparency,
    setReduceTransparency,
    onResetDefaults: resetDefaults,
    ...overrides,
  };

  const trigger = (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Open settings"
      className={triggerClassName}
    >
      <Settings className="size-5" />
    </Button>
  );

  if (isDesktop) {
    return (
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className={dialogOverlayClassName(reduceTransparency)} />
          <Dialog.Content
            data-settings-modal
            className={cn(
              "fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-1.5rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border bg-background p-4 shadow-xl scrollbar-hide sm:rounded-xl sm:p-6",
              reduceTransparency ? "border-zinc-700" : "border-white/10",
              DIALOG_CONTENT_ANIMATION,
            )}
          >
            <Dialog.Title className="mb-2 shrink-0 text-lg font-semibold text-foreground">
              {title}
            </Dialog.Title>
            <Dialog.Description className="mb-4 shrink-0 text-sm text-muted-foreground">
              {DESCRIPTION}
            </Dialog.Description>
            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide">
              <ReaderSettingsContent idPrefix="" {...contentProps} />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent
        data-settings-modal
        className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden scrollbar-hide"
        overlayClassName={reduceTransparency ? "bg-black" : undefined}
      >
        <DrawerHeader className="shrink-0 text-left">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{DESCRIPTION}</DrawerDescription>
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide px-4 pb-6">
          <ReaderSettingsContent idPrefix="drawer-" {...contentProps} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
