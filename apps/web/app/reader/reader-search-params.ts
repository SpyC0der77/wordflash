import {
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

const FONT_SIZES = ["sm", "md", "lg", "xl"] as const;
const THEMES = ["light", "black", "gray", "system"] as const;

export const readerSearchParams = {
  /** Article URL to load. */
  url: parseAsString.withOptions({
    clearOnDefault: true,
  }),
  /** Words per minute override (50–1200). Clamped in component. */
  wpm: parseAsInteger.withDefault(0).withOptions({ clearOnDefault: true }),
  /** Theme override. */
  theme: parseAsStringLiteral(THEMES).withOptions({ clearOnDefault: true }),
  /** Font size override. */
  fontSize: parseAsStringLiteral(FONT_SIZES).withOptions({
    clearOnDefault: true,
  }),
};
