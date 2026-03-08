"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Kbd } from "@/components/ui/kbd";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { THEMES, type Theme } from "@/lib/theme-context";
import {
  FOCAL_COLORS,
  FONT_FAMILIES,
  FONT_SIZES,
  type FocalColorKey,
  type FontFamilyKey,
  type FontSizeKey,
} from "@/components/speed-reader";
import { cn } from "@/lib/utils";

interface ReaderSettingsContentProps {
  idPrefix: string;
  theme: Theme;
  setTheme: (v: Theme) => void;
  fontSize: FontSizeKey;
  setFontSize: (v: FontSizeKey) => void;
  fontFamily: FontFamilyKey;
  setFontFamily: (v: FontFamilyKey) => void;
  focalColor: FocalColorKey;
  setFocalColor: (v: FocalColorKey) => void;
  sentenceEndDurationMs: number;
  setSentenceEndDurationMs: (v: number) => void;
  speechBreakDurationMs: number;
  setSpeechBreakDurationMs: (v: number) => void;
  reduceTransparency: boolean;
  setReduceTransparency: (v: boolean) => void;
  reduceMotion: boolean;
  setReduceMotion: (v: boolean) => void;
  showKeyboardShortcuts?: boolean;
}

export function ReaderSettingsContent({
  idPrefix,
  theme,
  setTheme,
  fontSize,
  setFontSize,
  fontFamily,
  setFontFamily,
  focalColor,
  setFocalColor,
  sentenceEndDurationMs,
  setSentenceEndDurationMs,
  speechBreakDurationMs,
  setSpeechBreakDurationMs,
  reduceTransparency,
  setReduceTransparency,
  reduceMotion,
  setReduceMotion,
  showKeyboardShortcuts = true,
}: ReaderSettingsContentProps) {
  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor={`${idPrefix}reader-theme-select`}
          className="mb-2 block text-sm font-medium text-foreground"
        >
          Theme
        </label>
        <Select value={theme} onValueChange={(v) => setTheme(v as Theme)}>
          <SelectTrigger id={`${idPrefix}reader-theme-select`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(THEMES) as Theme[]).map((key) => (
              <SelectItem key={key} value={key}>
                {THEMES[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label
          htmlFor={`${idPrefix}reader-font-size`}
          className="mb-2 block text-sm font-medium text-foreground"
        >
          Font size
        </label>
        <Select value={fontSize} onValueChange={(v) => setFontSize(v as FontSizeKey)}>
          <SelectTrigger id={`${idPrefix}reader-font-size`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(FONT_SIZES) as FontSizeKey[]).map((key) => (
              <SelectItem key={key} value={key}>
                {FONT_SIZES[key].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label
          htmlFor={`${idPrefix}reader-font-family`}
          className="mb-2 block text-sm font-medium text-foreground"
        >
          Font family
        </label>
        <Select
          value={fontFamily}
          onValueChange={(v) => setFontFamily(v as FontFamilyKey)}
        >
          <SelectTrigger id={`${idPrefix}reader-font-family`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(FONT_FAMILIES) as FontFamilyKey[]).map((key) => (
              <SelectItem key={key} value={key}>
                {FONT_FAMILIES[key].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label
          htmlFor={`${idPrefix}reader-focal-color`}
          className="mb-2 block text-sm font-medium text-foreground"
        >
          Focal character color
        </label>
        <Select
          value={focalColor}
          onValueChange={(v) => setFocalColor(v as FocalColorKey)}
        >
          <SelectTrigger id={`${idPrefix}reader-focal-color`}>
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "size-3 shrink-0 rounded-full",
                  FOCAL_COLORS[focalColor].previewClass,
                )}
              />
              <SelectValue />
            </span>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(FOCAL_COLORS) as FocalColorKey[]).map((key) => (
              <SelectItem key={key} value={key}>
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "size-3 shrink-0 rounded-full",
                      FOCAL_COLORS[key].previewClass,
                    )}
                  />
                  {FOCAL_COLORS[key].label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label
          htmlFor={`${idPrefix}sentence-end`}
          className="mb-2 block text-sm font-medium text-foreground"
        >
          Sentence End Duration ({sentenceEndDurationMs}ms)
        </label>
        <Slider
          id={`${idPrefix}sentence-end`}
          min={0}
          max={1000}
          step={50}
          value={[sentenceEndDurationMs]}
          onValueChange={([v]) => setSentenceEndDurationMs(v ?? 500)}
        />
      </div>
      <div>
        <label
          htmlFor={`${idPrefix}speech-break`}
          className="mb-2 block text-sm font-medium text-foreground"
        >
          Speech Break Duration ({speechBreakDurationMs}ms)
        </label>
        <Slider
          id={`${idPrefix}speech-break`}
          min={0}
          max={1000}
          step={25}
          value={[speechBreakDurationMs]}
          onValueChange={([v]) => setSpeechBreakDurationMs(v ?? 250)}
        />
      </div>
      <div className="flex items-center justify-between gap-4">
        <label
          htmlFor={`${idPrefix}reduce-transparency`}
          className="text-sm font-medium text-foreground"
        >
          Reduce transparency
        </label>
        <Switch
          id={`${idPrefix}reduce-transparency`}
          checked={reduceTransparency}
          onCheckedChange={setReduceTransparency}
        />
      </div>
      <div className="flex items-center justify-between gap-4">
        <label
          htmlFor={`${idPrefix}reduce-motion`}
          className="text-sm font-medium text-foreground"
        >
          Reduce motion
        </label>
        <Switch
          id={`${idPrefix}reduce-motion`}
          checked={reduceMotion}
          onCheckedChange={setReduceMotion}
        />
      </div>
      {showKeyboardShortcuts && (
        <ul className="pt-2 text-xs text-muted-foreground list-disc pl-4 space-y-1">
          <li>
            <Kbd>Space</Kbd> — play/pause
          </li>
          <li>
            <Kbd>R</Kbd> — restart from beginning
          </li>
          <li>
            <Kbd>←</Kbd> <Kbd>→</Kbd> — skip words
          </li>
          <li>
            <Kbd>Home</Kbd> <Kbd>End</Kbd> — jump to start/end
          </li>
          <li>
            <Kbd>Ctrl</Kbd>/<Kbd>⌘</Kbd> + <Kbd>⇧</Kbd> + <Kbd>C</Kbd> — copy
            shareable link
          </li>
        </ul>
      )}
    </div>
  );
}
