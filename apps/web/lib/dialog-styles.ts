import { cn } from "@/lib/utils";

const FADE_ANIMATION =
  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0";

export const DIALOG_CONTENT_ANIMATION = `${FADE_ANIMATION} data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95`;

export function dialogOverlayClassName(
  reduceTransparency: boolean,
  translucentBackground = "bg-black/80",
): string {
  return cn(
    "fixed inset-0 z-50",
    reduceTransparency ? "bg-black" : translucentBackground,
    FADE_ANIMATION,
  );
}
