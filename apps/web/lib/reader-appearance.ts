export const FONT_SIZES = {
  sm: { label: "Small", className: "text-3xl sm:text-4xl md:text-5xl" },
  md: { label: "Medium", className: "text-4xl sm:text-5xl md:text-6xl" },
  lg: { label: "Large", className: "text-5xl sm:text-6xl md:text-7xl" },
  xl: { label: "Extra large", className: "text-6xl sm:text-7xl md:text-8xl" },
} as const;

export const FONT_FAMILIES = {
  sans: { label: "Sans", className: "font-sans" },
  serif: { label: "Serif", className: "font-serif" },
  mono: { label: "Mono", className: "font-mono" },
} as const;

export const FOCAL_COLORS = {
  rose: {
    label: "Rose",
    className: "text-rose-500",
    previewClass: "bg-rose-500",
  },
  blue: {
    label: "Blue",
    className: "text-blue-500",
    previewClass: "bg-blue-500",
  },
  green: {
    label: "Green",
    className: "text-green-500",
    previewClass: "bg-green-500",
  },
  amber: {
    label: "Amber",
    className: "text-amber-500",
    previewClass: "bg-amber-500",
  },
} as const;

export type FontSizeKey = keyof typeof FONT_SIZES;
export type FontFamilyKey = keyof typeof FONT_FAMILIES;
export type FocalColorKey = keyof typeof FOCAL_COLORS;
