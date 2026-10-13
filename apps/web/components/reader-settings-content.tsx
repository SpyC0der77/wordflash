"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
} from "@/lib/reader-appearance";
import { cn } from "@/lib/utils";

const LABEL_CLASS =
  "text-sm font-medium text-zinc-600 dark:text-zinc-500";

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
  showPunctuationGlyph: boolean;
  setShowPunctuationGlyph: (v: boolean) => void;
  punctuationGlyphLeadMs: number;
  setPunctuationGlyphLeadMs: (v: number) => void;
  punctuationGlyphDurationMs: number;
  setPunctuationGlyphDurationMs: (v: number) => void;
  punctuationGlyphAlwaysVisible: boolean;
  setPunctuationGlyphAlwaysVisible: (v: boolean) => void;
  centerPunctuationTittleVertically: boolean;
  setCenterPunctuationTittleVertically: (v: boolean) => void;
  reduceTransparency: boolean;
  setReduceTransparency: (v: boolean) => void;
  reduceMotion: boolean;
  setReduceMotion: (v: boolean) => void;
  showKeyboardShortcuts?: boolean;
  showShareShortcut?: boolean;
  onResetDefaults?: () => void;
}

function Field({
  id,
  label,
  children,
}: {
  id?: string;
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className={cn("mb-2 block", LABEL_CLASS)}>
        {label}
      </label>
      {children}
    </div>
  );
}

function SwitchRow({
  id,
  label,
  checked,
  onCheckedChange,
  disabled,
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </div>
  );
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
  showPunctuationGlyph,
  setShowPunctuationGlyph,
  punctuationGlyphLeadMs,
  setPunctuationGlyphLeadMs,
  punctuationGlyphDurationMs,
  setPunctuationGlyphDurationMs,
  punctuationGlyphAlwaysVisible,
  setPunctuationGlyphAlwaysVisible,
  centerPunctuationTittleVertically,
  setCenterPunctuationTittleVertically,
  reduceTransparency,
  setReduceTransparency,
  reduceMotion,
  setReduceMotion,
  showKeyboardShortcuts = true,
  showShareShortcut = false,
  onResetDefaults,
}: ReaderSettingsContentProps) {
  const [accordionValue, setAccordionValue] = useState<string[]>([]);

  return (
    <div className="space-y-4">
      <Accordion
        type="multiple"
        value={accordionValue}
        onValueChange={setAccordionValue}
        className="w-full"
      >
        <AccordionItem value="appearance">
          <AccordionTrigger>Appearance</AccordionTrigger>
          <AccordionContent className="space-y-4">
            <Field id={`${idPrefix}theme-select`} label="Theme">
              <Select value={theme} onValueChange={(v) => setTheme(v as Theme)}>
                <SelectTrigger id={`${idPrefix}theme-select`}>
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
            </Field>
            <Field id={`${idPrefix}font-size`} label="Font size">
              <Select
                value={fontSize}
                onValueChange={(v) => setFontSize(v as FontSizeKey)}
              >
                <SelectTrigger id={`${idPrefix}font-size`}>
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
            </Field>
            <Field id={`${idPrefix}font-family`} label="Font family">
              <Select
                value={fontFamily}
                onValueChange={(v) => setFontFamily(v as FontFamilyKey)}
              >
                <SelectTrigger id={`${idPrefix}font-family`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(FONT_FAMILIES) as FontFamilyKey[]).map(
                    (key) => (
                      <SelectItem key={key} value={key}>
                        {FONT_FAMILIES[key].label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </Field>
            <Field id={`${idPrefix}focal-color`} label="Focal character color">
              <Select
                value={focalColor}
                onValueChange={(v) => setFocalColor(v as FocalColorKey)}
              >
                <SelectTrigger id={`${idPrefix}focal-color`}>
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
            </Field>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="timing">
          <AccordionTrigger>Timing</AccordionTrigger>
          <AccordionContent className="space-y-4">
            <Field
              id={`${idPrefix}sentence-end`}
              label={`Sentence end (${sentenceEndDurationMs}ms)`}
            >
              <Slider
                aria-label="Sentence end pause"
                id={`${idPrefix}sentence-end`}
                min={0}
                max={1000}
                step={50}
                value={[sentenceEndDurationMs]}
                onValueChange={([v]) => setSentenceEndDurationMs(v ?? 500)}
              />
            </Field>
            <Field
              id={`${idPrefix}speech-break`}
              label={`Speech break (${speechBreakDurationMs}ms)`}
            >
              <Slider
                aria-label="Speech break pause"
                id={`${idPrefix}speech-break`}
                min={0}
                max={1000}
                step={25}
                value={[speechBreakDurationMs]}
                onValueChange={([v]) => setSpeechBreakDurationMs(v ?? 250)}
              />
            </Field>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="punctuation">
          <AccordionTrigger>Punctuation</AccordionTrigger>
          <AccordionContent className="space-y-4">
            <SwitchRow
              id={`${idPrefix}punctuation-glyph`}
              label="Show glyph"
              checked={showPunctuationGlyph}
              onCheckedChange={setShowPunctuationGlyph}
            />
            {showPunctuationGlyph && (
              <>
                <Field
                  id={`${idPrefix}glyph-lead`}
                  label={`Lead-in (${punctuationGlyphLeadMs}ms)`}
                >
                  <Slider
                    aria-label="Punctuation lead-in"
                    id={`${idPrefix}glyph-lead`}
                    min={0}
                    max={200}
                    step={10}
                    value={[punctuationGlyphLeadMs]}
                    onValueChange={([v]) =>
                      setPunctuationGlyphLeadMs(v ?? 80)
                    }
                  />
                </Field>
                <SwitchRow
                  id={`${idPrefix}glyph-always-visible`}
                  label="Always visible"
                  checked={punctuationGlyphAlwaysVisible}
                  onCheckedChange={setPunctuationGlyphAlwaysVisible}
                />
                {!punctuationGlyphAlwaysVisible && (
                  <Field
                    id={`${idPrefix}glyph-duration`}
                    label={`Visible for (${punctuationGlyphDurationMs}ms)`}
                  >
                    <Slider
                      aria-label="Punctuation visible duration"
                      id={`${idPrefix}glyph-duration`}
                      min={0}
                      max={1000}
                      step={50}
                      value={[punctuationGlyphDurationMs]}
                      onValueChange={([v]) =>
                        setPunctuationGlyphDurationMs(v ?? 400)
                      }
                    />
                  </Field>
                )}
                <SwitchRow
                  id={`${idPrefix}center-tittle-vertically`}
                  label="Center ? / ! tittle vertically"
                  checked={centerPunctuationTittleVertically}
                  onCheckedChange={setCenterPunctuationTittleVertically}
                />
              </>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="accessibility">
          <AccordionTrigger>Accessibility</AccordionTrigger>
          <AccordionContent className="space-y-4">
            <SwitchRow
              id={`${idPrefix}reduce-transparency`}
              label="Reduce transparency"
              checked={reduceTransparency}
              onCheckedChange={setReduceTransparency}
            />
            <SwitchRow
              id={`${idPrefix}reduce-motion`}
              label="Reduce motion"
              checked={reduceMotion}
              onCheckedChange={setReduceMotion}
            />
          </AccordionContent>
        </AccordionItem>

        {showKeyboardShortcuts && (
          <AccordionItem value="shortcuts">
            <AccordionTrigger>Shortcuts</AccordionTrigger>
            <AccordionContent>
              <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
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
                {showShareShortcut && (
                  <li>
                    <Kbd>Ctrl</Kbd>/<Kbd>⌘</Kbd> + <Kbd>⇧</Kbd> + <Kbd>C</Kbd>{" "}
                    — copy shareable link
                  </li>
                )}
              </ul>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
      {onResetDefaults && (
        <Button
          variant="outline"
          className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={onResetDefaults}
        >
          Reset defaults
        </Button>
      )}
    </div>
  );
}
