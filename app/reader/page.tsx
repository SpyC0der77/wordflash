"use client";

import DOMPurify from "dompurify";
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, BookOpen, Gauge, Loader2, Settings } from "lucide-react";
import { Dialog } from "radix-ui";
import { SpeedReader } from "@/components/speed-reader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useReduceMotion } from "@/lib/reduce-motion-context";
import { useReduceTransparency } from "@/lib/reduce-transparency-context";
import { useTheme, THEMES, type Theme } from "@/lib/theme-context";
import {
  FONT_FAMILIES,
  FONT_SIZES,
  type FontFamilyKey,
  type FontSizeKey,
} from "@/components/speed-reader";
import {
  attachTrailingCommasToLinks,
  extractTextFromHtml,
  wrapWordsInHtml,
} from "@/lib/speed-reader";
import { cn } from "@/lib/utils";

interface MediaPreview {
  src: string;
  type: "image" | "video" | "iframe";
}

interface ArticleBodyProps {
  html: string;
  wordIndex: number;
  onWordClick?: (index: number) => void;
  onMediaClick?: (media: MediaPreview) => void;
  scrollToWord?: (span: HTMLElement) => void;
}

const ArticleBody = forwardRef<HTMLDivElement, ArticleBodyProps>(function ArticleBody(
  { html, wordIndex, onWordClick, onMediaClick, scrollToWord },
  ref,
) {
  const prevHighlightRef = useRef<HTMLElement | null>(null);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const media = (e.target as HTMLElement).closest("img, video, iframe");
    if (media && onMediaClick) {
      e.preventDefault();
      e.stopPropagation();
      if (media instanceof HTMLImageElement) {
        onMediaClick({ src: media.src, type: "image" });
        return;
      }
      if (media instanceof HTMLVideoElement) {
        const src = media.currentSrc || media.src || media.querySelector("source")?.getAttribute("src");
        if (src) onMediaClick({ src, type: "video" });
        return;
      }
      if (media instanceof HTMLIFrameElement) {
        onMediaClick({ src: media.src, type: "iframe" });
        return;
      }
    }

    const target = (e.target as HTMLElement).closest("[data-word-index]");
    if (target) {
      const index = parseInt(target.getAttribute("data-word-index") ?? "0", 10);
      onWordClick?.(index);
    }
  }

  useEffect(() => {
    const container =
      typeof ref !== "function" && ref !== null
        ? (ref as React.RefObject<HTMLDivElement>).current
        : null;
    if (!container) return;

    const span = container.querySelector(
      `[data-word-index="${wordIndex}"]`,
    ) as HTMLElement | null;

    const prevSpan = prevHighlightRef.current;
    const prevRect = prevSpan?.getBoundingClientRect();
    if (prevSpan) {
      prevSpan.classList.remove("speed-reader-highlight");
      prevHighlightRef.current = null;
    }

    if (span) {
      span.classList.add("speed-reader-highlight");
      prevHighlightRef.current = span;
      const rect = span.getBoundingClientRect();
      const lineHeight = rect.height;
      const isNewLine =
        !prevRect || Math.abs(rect.top - prevRect.top) > lineHeight * 0.5;
      const viewportHeight = window.innerHeight;
      const margin = viewportHeight * 0.2;
      const isComfortablyVisible =
        rect.top >= margin && rect.bottom <= viewportHeight - margin;
      if (isNewLine || !isComfortablyVisible) {
        if (scrollToWord) {
          scrollToWord(span);
        } else {
          span.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    }
  }, [wordIndex, ref, scrollToWord]);

  return (
    <div
      ref={ref}
      onClick={(onWordClick || onMediaClick) ? handleClick : undefined}
      className={cn(
        "reader-article space-y-4 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold [&_p]:leading-7 [&_a]:text-primary [&_a]:underline [&_a:hover]:opacity-80 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_blockquote]:border-l-4 [&_blockquote]:border-muted-foreground/50 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_img]:rounded-lg [&_img]:max-w-full [&_img]:cursor-pointer [&_video]:cursor-pointer [&_iframe]:cursor-pointer",
        onWordClick &&
          "cursor-pointer [&_[data-word-index]]:cursor-pointer [&_[data-word-index]]:rounded-sm [&_[data-word-index]]:transition-colors [&_[data-word-index]]:hover:bg-muted/50",
      )}
      dangerouslySetInnerHTML={{
        __html: DOMPurify.sanitize(html, {
          ALLOWED_ATTR: ["href", "src", "alt", "title", "data-word-index"],
          ADD_ATTR: ["data-word-index"],
        }),
      }}
    />
  );
});

interface ArticleData {
  title: string | null;
  content: string;
  textContent?: string;
  excerpt: string | null;
  byline: string | null;
  siteName: string | null;
}

const DEFAULT_SENTENCE_END_MS = 500;
const DEFAULT_SPEECH_BREAK_MS = 250;

export default function ReaderPage() {
  const searchParams = useSearchParams();
  const { reduceMotion, setReduceMotion } = useReduceMotion();
  const { reduceTransparency, setReduceTransparency } = useReduceTransparency();
  const { theme, setTheme } = useTheme();
  const [url, setUrl] = useState("");
  const [article, setArticle] = useState<ArticleData | null>(null);
  const [wrappedContent, setWrappedContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wordIndex, setWordIndex] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [sentenceEndDurationMs, setSentenceEndDurationMs] = useState(
    DEFAULT_SENTENCE_END_MS,
  );
  const [speechBreakDurationMs, setSpeechBreakDurationMs] = useState(
    DEFAULT_SPEECH_BREAK_MS,
  );
  const [fontSize, setFontSize] = useState<FontSizeKey>("md");
  const [fontFamily, setFontFamily] = useState<FontFamilyKey>("serif");
  const [showArticleOnMobile, setShowArticleOnMobile] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<MediaPreview | null>(null);
  const articleBodyRef = useRef<HTMLDivElement>(null);
  const articleHeaderRef = useRef<HTMLElement>(null);
  const articleScrollContainerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = useState(420);

  const scrollToWordInArticleArea = useCallback(
    (span: HTMLElement) => {
      const header = articleHeaderRef.current;
      const panel = panelRef.current;
      const scrollContainer = articleScrollContainerRef.current;
      const headerRect = header?.getBoundingClientRect();
      const panelRect = panel?.getBoundingClientRect();
      const spanRect = span.getBoundingClientRect();
      const spanCenter = spanRect.top + spanRect.height / 2;
      const scrollBehavior = reduceMotion ? "auto" : "smooth";

      const isScrollable =
        scrollContainer &&
        getComputedStyle(scrollContainer).overflow !== "visible";
      if (isScrollable && scrollContainer) {
        const containerRect = scrollContainer.getBoundingClientRect();
        const visibleCenter =
          containerRect.top + containerRect.height / 2;
        const delta = spanCenter - visibleCenter;
        scrollContainer.scrollBy({ top: delta, behavior: scrollBehavior });
      } else if (headerRect && panelRect) {
        const visibleTop = Math.max(headerRect.bottom, 0);
        const visibleBottom = panelRect.top;
        const visibleCenter = (visibleTop + visibleBottom) / 2;
        const delta = spanCenter - visibleCenter;
        window.scrollBy({ top: delta, behavior: scrollBehavior });
      } else {
        span.scrollIntoView({ behavior: scrollBehavior, block: "center" });
      }
    },
    [articleHeaderRef, panelRef, articleScrollContainerRef, reduceMotion],
  );

  // Preprocess content so trailing commas after links are attached to the link text.
  const processedContent = useMemo(
    () => (article?.content ? attachTrailingCommasToLinks(article.content) : null),
    [article?.content],
  );

  // Use same word-boundary logic as wrapWordsInHtml so Reader View highlight matches SpeedReader.
  const articleText = useMemo(
    () => (processedContent ? extractTextFromHtml(processedContent) : ""),
    [processedContent],
  );

  useEffect(() => {
    if (!processedContent) {
      setWrappedContent(null);
      return;
    }
    setWrappedContent(wrapWordsInHtml(processedContent));
    setWordIndex(0);
    setShowArticleOnMobile(false);
  }, [processedContent]);

  function handleWordClick(index: number) {
    setWordIndex(index);
    setShowArticleOnMobile(false);
  }

  function handleMediaClick(media: MediaPreview) {
    try {
      const url = new URL(media.src, window.location.href);
      if (!["http:", "https:"].includes(url.protocol)) return;
      setMediaPreview({ ...media, src: url.href });
    } catch {
      // Invalid URL, ignore
    }
  }

  const COMPACT_VIEW_MIN_HEIGHT = 650;

  const [isCompactView, setIsCompactView] = useState(true);
  useEffect(() => {
    const mqWide = window.matchMedia("(min-width: 768px)");
    const mqTall = window.matchMedia(
      `(min-height: ${COMPACT_VIEW_MIN_HEIGHT}px)`,
    );
    const update = () => setIsCompactView(!(mqWide.matches && mqTall.matches));
    update();
    mqWide.addEventListener("change", update);
    mqTall.addEventListener("change", update);
    return () => {
      mqWide.removeEventListener("change", update);
      mqTall.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const setHeight = () =>
      setPanelHeight(!isCompactView ? el.offsetHeight : 0);
    setHeight();
    const ro = new ResizeObserver(setHeight);
    ro.observe(el);
    return () => ro.disconnect();
  }, [article, isCompactView]);

  const loadArticle = useCallback(async (articleUrl: string) => {
    const trimmed = articleUrl.trim();
    if (!trimmed) return;

    setIsLoading(true);
    setError(null);
    setArticle(null);
    setWrappedContent(null);

    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to extract article");
      }

      setArticle(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const paramUrl = searchParams.get("url") ?? searchParams.get("u");
    if (paramUrl?.trim()) {
      setUrl(paramUrl.trim());
      loadArticle(paramUrl);
    }
  }, [searchParams, loadArticle]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    loadArticle(url);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header
          className={cn(
            "sticky top-0 z-10 border-b border-border/50",
            reduceTransparency
              ? "bg-background"
              : "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
          )}
        >
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/" aria-label="Back to home">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <form onSubmit={handleSubmit} className="flex flex-1 gap-2">
            <Input
              type="url"
              placeholder="Enter article URL..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  <span className="sr-only">Read</span>
                </>
              ) : (
                "Read"
              )}
            </Button>
          </form>
          <Dialog.Root open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <Dialog.Trigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open settings">
                <Settings className="size-5" />
              </Button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay
                className={cn(
                  "fixed inset-0 z-50",
                  reduceTransparency ? "bg-black" : "bg-black/80",
                  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                )}
              />
              <Dialog.Content
                className={cn(
                  "fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-zinc-900 p-6 shadow-xl",
                  reduceTransparency ? "border-zinc-700" : "border-white/10",
                  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
                )}
              >
                <Dialog.Title className="mb-4 text-lg font-semibold text-zinc-100">
                  Reader Settings
                </Dialog.Title>
                <Dialog.Description className="mb-4 text-sm text-muted-foreground">
                  Adjust pause durations (values at 250 WPM; scale with speed).
                </Dialog.Description>
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="reader-theme-select"
                      className="mb-2 block text-sm font-medium text-zinc-100"
                    >
                      Theme
                    </label>
                    <Select
                      value={theme}
                      onValueChange={(v) => setTheme(v as Theme)}
                    >
                      <SelectTrigger id="reader-theme-select">
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
                      htmlFor="reader-font-size"
                      className="mb-2 block text-sm font-medium text-zinc-100"
                    >
                      Font size
                    </label>
                    <Select
                      value={fontSize}
                      onValueChange={(v) =>
                        setFontSize(v as FontSizeKey)
                      }
                    >
                      <SelectTrigger id="reader-font-size">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(FONT_SIZES) as FontSizeKey[]).map(
                          (key) => (
                            <SelectItem key={key} value={key}>
                              {FONT_SIZES[key].label}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label
                      htmlFor="reader-font-family"
                      className="mb-2 block text-sm font-medium text-zinc-100"
                    >
                      Font family
                    </label>
                    <Select
                      value={fontFamily}
                      onValueChange={(v) =>
                        setFontFamily(v as FontFamilyKey)
                      }
                    >
                      <SelectTrigger id="reader-font-family">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(FONT_FAMILIES) as FontFamilyKey[]).map(
                          (key) => (
                            <SelectItem key={key} value={key}>
                              {FONT_FAMILIES[key].label}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label
                      htmlFor="sentence-end"
                      className="mb-2 block text-sm font-medium text-zinc-100"
                    >
                      Sentence End Duration ({sentenceEndDurationMs}ms)
                    </label>
                    <Slider
                      id="sentence-end"
                      min={0}
                      max={1000}
                      step={50}
                      value={[sentenceEndDurationMs]}
                      onValueChange={([v]) =>
                        setSentenceEndDurationMs(v ?? DEFAULT_SENTENCE_END_MS)
                      }
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="speech-break"
                      className="mb-2 block text-sm font-medium text-zinc-100"
                    >
                      Speech Break Duration ({speechBreakDurationMs}ms)
                    </label>
                    <Slider
                      id="speech-break"
                      min={0}
                      max={1000}
                      step={25}
                      value={[speechBreakDurationMs]}
                      onValueChange={([v]) =>
                        setSpeechBreakDurationMs(v ?? DEFAULT_SPEECH_BREAK_MS)
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <label
                      htmlFor="reduce-transparency"
                      className="text-sm font-medium text-zinc-100"
                    >
                      Reduce transparency
                    </label>
                    <Switch
                      id="reduce-transparency"
                      checked={reduceTransparency}
                      onCheckedChange={setReduceTransparency}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <label
                      htmlFor="reduce-motion"
                      className="text-sm font-medium text-zinc-100"
                    >
                      Reduce motion
                    </label>
                    <Switch
                      id="reduce-motion"
                      checked={reduceMotion}
                      onCheckedChange={setReduceMotion}
                    />
                  </div>
                  <p className="pt-2 text-xs text-muted-foreground">
                    Keyboard: Space to play/pause, ← → to skip words
                  </p>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </header>

      <main
        className={cn(
          "mx-auto flex max-w-3xl flex-1 flex-col px-4 pt-8",
          article && "min-h-0",
        )}
        style={
          article && !isCompactView
            ? { paddingBottom: `${panelHeight}px` }
            : undefined
        }
      >
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-destructive">
            {error}
          </div>
        )}

        {article && (
          <article className="reader-content flex min-h-0 flex-1 flex-col">
            <header
              ref={articleHeaderRef}
              className={cn("shrink-0", isCompactView ? "mb-4" : "mb-8")}
            >
              {(article.siteName || article.byline) && (
                <p className="mb-2 text-sm text-muted-foreground">
                  {[article.siteName, article.byline]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                {article.title ?? "Untitled"}
              </h1>
              {article.excerpt && (
                <p className="mt-3 text-lg text-muted-foreground">
                  {article.excerpt}
                </p>
              )}
              <div
                className={cn("mt-4 flex w-full", !isCompactView && "hidden")}
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowArticleOnMobile(!showArticleOnMobile)}
                  className="w-full gap-2"
                >
                  {showArticleOnMobile ? (
                    <>
                      <Gauge className="size-4" />
                      Show speed reader
                    </>
                  ) : (
                    <>
                      <BookOpen className="size-4" />
                      Show article
                    </>
                  )}
                </Button>
              </div>
            </header>

            <div className="relative flex min-h-0 flex-1 flex-col">
              {showArticleOnMobile || !isCompactView ? (
                <div
                  ref={articleScrollContainerRef}
                  className={cn(
                    "min-h-0 flex-1 flex-col overflow-auto",
                    !isCompactView && "flex-none overflow-visible",
                  )}
                >
                  <ArticleBody
                    ref={articleBodyRef}
                    html={wrappedContent ?? processedContent ?? article?.content ?? ""}
                    wordIndex={wordIndex}
                    onWordClick={handleWordClick}
                    onMediaClick={handleMediaClick}
                    scrollToWord={scrollToWordInArticleArea}
                  />
                </div>
              ) : null}

              {articleText && isCompactView && !showArticleOnMobile && (
                <div className="flex min-h-0 flex-1 flex-col">
                  <SpeedReader
                    key={article.content}
                    variant="panel"
                    text={articleText}
                    onWordIndexChange={setWordIndex}
                    controlledWordIndex={wordIndex}
                    sentenceEndDurationMsAt250Wpm={sentenceEndDurationMs}
                    speechBreakDurationMsAt250Wpm={speechBreakDurationMs}
                    fontSize={fontSize}
                    fontFamily={fontFamily}
                    fillHeight
                    className="flex-1 min-h-0 justify-center border-0"
                  />
                </div>
              )}
            </div>
          </article>
        )}

        {!article && !error && !isLoading && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-muted-foreground">
              Paste an article URL above to extract and read it in a clean,
              focused view.
            </p>
          </div>
        )}
      </main>

      {article && articleText && !isCompactView && (
        <div ref={panelRef} className="fixed bottom-0 left-0 right-0 z-20">
          <SpeedReader
            key={article.content}
            variant="panel"
            text={articleText}
            onWordIndexChange={setWordIndex}
            controlledWordIndex={wordIndex}
            sentenceEndDurationMsAt250Wpm={sentenceEndDurationMs}
            speechBreakDurationMsAt250Wpm={speechBreakDurationMs}
            fontSize={fontSize}
            fontFamily={fontFamily}
          />
        </div>
      )}

      <Dialog.Root open={!!mediaPreview} onOpenChange={(open) => !open && setMediaPreview(null)}>
        <Dialog.Portal>
          <Dialog.Overlay
            className={cn(
              "fixed inset-0 z-50",
              reduceTransparency ? "bg-black" : "bg-black/90",
              "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            )}
          />
          <Dialog.Content
            className={cn(
              "fixed left-1/2 top-1/2 z-50 max-h-[90vh] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border border-white/10 bg-black p-2 focus:outline-none",
              "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            )}
          >
            {mediaPreview?.type === "image" && (
              <img
                src={mediaPreview.src}
                alt="Preview"
                className="max-h-[85vh] max-w-full object-contain"
              />
            )}
            {mediaPreview?.type === "video" && (
              <video
                src={mediaPreview.src}
                controls
                autoPlay
                className="max-h-[85vh] max-w-full"
              />
            )}
            {mediaPreview?.type === "iframe" && (
              <iframe
                src={mediaPreview.src}
                title="Embedded media"
                className="h-[85vh] w-[90vw] max-w-4xl border-0"
                allowFullScreen
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
