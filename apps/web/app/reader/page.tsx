"use client";

import DOMPurify from "dompurify";
import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Bookmark,
  BookOpen,
  Gauge,
  History,
  Link2,
  Loader2,
  Menu,
  Settings,
} from "lucide-react";
import { Dialog } from "radix-ui";
import { SpeedReader } from "@/components/speed-reader";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useReaderSettings } from "@/lib/reader-settings-context";
import { useReduceMotion } from "@/lib/reduce-motion-context";
import { useReduceTransparency } from "@/lib/reduce-transparency-context";
import { useTheme } from "@/lib/theme-context";
import { ReaderSettingsContent } from "@/app/reader/reader-settings-content";
import {
  attachTrailingCommasToLinks,
  calculateReadingTimeMs,
  extractTextFromHtml,
  parseWords,
  wrapWordsInHtml,
} from "@/lib/speed-reader";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

const ArticleBody = forwardRef<HTMLDivElement, ArticleBodyProps>(
  function ArticleBody(
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
          const src =
            media.currentSrc ||
            media.src ||
            media.querySelector("source")?.getAttribute("src");
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
        const index = parseInt(
          target.getAttribute("data-word-index") ?? "0",
          10,
        );
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
        onClick={onWordClick || onMediaClick ? handleClick : undefined}
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
  },
);

interface ArticleData {
  title: string | null;
  content: string;
  textContent?: string;
  excerpt: string | null;
  byline: string | null;
  siteName: string | null;
}

const READING_POSITION_KEY = "speedreader-reading-position";
const PREVIOUS_ARTICLES_KEY = "speedreader-previous-articles";
const PREVIOUS_ARTICLES_MAX = 15;

interface PreviousArticle {
  url: string;
  title: string;
}

export default function ReaderPage() {
  const searchParams = useSearchParams();
  const { reduceMotion, setReduceMotion } = useReduceMotion();
  const { reduceTransparency, setReduceTransparency } = useReduceTransparency();
  const { theme, setTheme } = useTheme();
  const readerSettings = useReaderSettings();
  const {
    fontSize,
    fontFamily,
    focalColor,
    sentenceEndDurationMs,
    speechBreakDurationMs,
    wordsPerMinute,
    setFontSize,
    setFontFamily,
    setFocalColor,
    setSentenceEndDurationMs,
    setSpeechBreakDurationMs,
  } = readerSettings;
  const [url, setUrl] = useState("");
  const [article, setArticle] = useState<ArticleData | null>(null);
  const [wrappedContent, setWrappedContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wordIndex, setWordIndex] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [showArticleOnMobile, setShowArticleOnMobile] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<MediaPreview | null>(null);
  const [previousArticles, setPreviousArticles] = useState<PreviousArticle[]>(
    [],
  );
  const [isBookmarkletOpen, setIsBookmarkletOpen] = useState(false);

  const setBookmarkletRef = useCallback((node: HTMLAnchorElement | null) => {
    if (node && typeof window !== "undefined") {
      node.href = `javascript:(function(){location.href='${window.location.origin}/reader?url='+encodeURIComponent(location.href)})()`;
    }
  }, []);

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
        const visibleCenter = containerRect.top + containerRect.height / 2;
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
    () =>
      article?.content ? attachTrailingCommasToLinks(article.content) : null,
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
    setShowArticleOnMobile(false);
    const words = parseWords(extractTextFromHtml(processedContent));
    const wordCount = words.length;
    if (wordCount === 0) {
      setWordIndex(0);
      return;
    }
    try {
      const stored = localStorage.getItem(READING_POSITION_KEY);
      if (stored && url) {
        const { url: storedUrl, wordIndex: storedIndex } = JSON.parse(
          stored,
        ) as {
          url?: string;
          wordIndex?: number;
        };
        if (storedUrl === url && typeof storedIndex === "number") {
          const restoredIndex = Math.min(
            Math.max(0, storedIndex),
            wordCount - 1,
          );
          const id = setTimeout(() => {
            setWordIndex(restoredIndex);
            toast.info("Resumed from previous session");
          }, 100);
          return () => clearTimeout(id);
        }
      }
    } catch {
      // Ignore
    }
    setWordIndex(0);
  }, [processedContent, url]);

  useEffect(() => {
    if (!article || !url) return;
    try {
      localStorage.setItem(
        READING_POSITION_KEY,
        JSON.stringify({ url, wordIndex }),
      );
    } catch {
      // Ignore
    }
  }, [article, url, wordIndex]);

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

      const entry: PreviousArticle = {
        url: trimmed,
        title: data.title ?? new URL(trimmed).hostname,
      };
      setPreviousArticles((prev) => {
        const filtered = prev.filter((a) => a.url !== trimmed);
        const next = [entry, ...filtered].slice(0, PREVIOUS_ARTICLES_MAX);
        try {
          localStorage.setItem(PREVIOUS_ARTICLES_KEY, JSON.stringify(next));
        } catch {
          // Ignore
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(PREVIOUS_ARTICLES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as PreviousArticle[];
        if (Array.isArray(parsed)) {
          setPreviousArticles(parsed);
        }
      }
    } catch {
      // Ignore
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

  const handleCopyLink = useCallback(async () => {
    if (!article || !url) return;
    const shareUrl = `${window.location.origin}/reader?url=${encodeURIComponent(url)}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      toast.success("Link copied");
    } catch {
      // Ignore
    }
  }, [article, url]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const el = document.activeElement;
      const tag = el?.tagName.toLowerCase();
      if (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        el?.getAttribute("contenteditable") === "true" ||
        el?.closest("[role='dialog']")
      ) {
        return;
      }
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "c"
      ) {
        e.preventDefault();
        handleCopyLink();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleCopyLink]);

  const readingTimeMs = useMemo(() => {
    if (!articleText) return 0;
    const words = parseWords(articleText);
    return calculateReadingTimeMs(
      words,
      wordsPerMinute,
      sentenceEndDurationMs,
      speechBreakDurationMs,
      0,
      words.length - 1,
    );
  }, [
    articleText,
    wordsPerMinute,
    sentenceEndDurationMs,
    speechBreakDurationMs,
  ]);

  const readingTimeLabel =
    readingTimeMs >= 60000
      ? `~${Math.round(readingTimeMs / 60000)} min read`
      : `~${Math.round(readingTimeMs / 1000)} sec read`;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header
        className={cn(
          "sticky top-0 z-10 border-b border-border/50 print:hidden",
          reduceTransparency
            ? "bg-background"
            : "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        )}
      >
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 px-3 py-3 sm:gap-4 sm:px-4 sm:py-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/" aria-label="Back to home">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <form
            onSubmit={handleSubmit}
            className="order-last flex w-full flex-1 gap-2 sm:order-none sm:w-auto"
          >
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[12rem]">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <History className="size-4" />
                  Previously loaded articles
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {previousArticles.length === 0 ? (
                    <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                      No recent articles
                    </div>
                  ) : (
                    previousArticles.map((a) => (
                      <DropdownMenuItem
                        key={a.url}
                        onClick={() => {
                          setUrl(a.url);
                          loadArticle(a.url);
                        }}
                        className="max-w-[min(18rem,85vw)] cursor-pointer"
                      >
                        <span className="truncate" title={a.title}>
                          {a.title}
                        </span>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              {article && url && (
                <DropdownMenuItem
                  onClick={handleCopyLink}
                  className="cursor-pointer"
                >
                  <Link2 className="size-4" />
                  {copiedLink ? "Copied" : "Copy shareable link"}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => setIsBookmarkletOpen(true)}
                className="cursor-pointer"
              >
                <Bookmark className="size-4" />
                Bookmarklet
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Dialog.Root
            open={isBookmarkletOpen}
            onOpenChange={setIsBookmarkletOpen}
          >
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
                  "fixed left-1/2 top-1/2 z-50 w-[calc(100vw-1.5rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-zinc-900 p-4 shadow-xl sm:rounded-xl sm:p-6",
                  reduceTransparency ? "border-zinc-700" : "border-white/10",
                  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
                )}
              >
                <Dialog.Title className="mb-2 text-lg font-semibold text-zinc-100">
                  Bookmarklet
                </Dialog.Title>
                <Dialog.Description className="mb-4 text-sm text-muted-foreground">
                  Drag this link to your bookmarks bar. On any article page,
                  click it to open in SpeedReader.
                </Dialog.Description>
                <a
                  ref={setBookmarkletRef}
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className="inline-flex cursor-grab items-center gap-2 rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-100 transition-colors hover:bg-zinc-700"
                  title="Drag to your bookmarks bar"
                >
                  <Bookmark className="size-4 shrink-0" />
                  Read in SpeedReader
                </a>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
          {isDesktop ? (
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
                    "fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-1.5rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border bg-background p-4 shadow-xl sm:rounded-xl sm:p-6",
                    reduceTransparency ? "border-zinc-700" : "border-white/10",
                    "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
                  )}
                >
                  <Dialog.Title className="mb-2 shrink-0 text-lg font-semibold text-foreground">
                    Reader Settings
                  </Dialog.Title>
                  <Dialog.Description className="mb-4 shrink-0 text-sm text-muted-foreground">
                    Adjust pause durations (values at 250 WPM; scale with speed).
                  </Dialog.Description>
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    <ReaderSettingsContent
                      idPrefix=""
                      theme={theme}
                      setTheme={setTheme}
                      fontSize={fontSize}
                      setFontSize={setFontSize}
                      fontFamily={fontFamily}
                      setFontFamily={setFontFamily}
                      focalColor={focalColor}
                      setFocalColor={setFocalColor}
                      sentenceEndDurationMs={sentenceEndDurationMs}
                      setSentenceEndDurationMs={setSentenceEndDurationMs}
                      speechBreakDurationMs={speechBreakDurationMs}
                      setSpeechBreakDurationMs={setSpeechBreakDurationMs}
                      reduceTransparency={reduceTransparency}
                      setReduceTransparency={setReduceTransparency}
                      reduceMotion={reduceMotion}
                      setReduceMotion={setReduceMotion}
                      showKeyboardShortcuts
                    />
                  </div>
                </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
          ) : (
            <Drawer open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
              <DrawerTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open settings">
                  <Settings className="size-5" />
                </Button>
              </DrawerTrigger>
              <DrawerContent
                className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden"
                overlayClassName={
                  reduceTransparency ? "bg-black" : undefined
                }
              >
                <DrawerHeader className="shrink-0 text-left">
                  <DrawerTitle>Reader Settings</DrawerTitle>
                  <DrawerDescription>
                    Adjust pause durations (values at 250 WPM; scale with speed).
                  </DrawerDescription>
                </DrawerHeader>
                <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
                  <ReaderSettingsContent
                    idPrefix="drawer-"
                    theme={theme}
                    setTheme={setTheme}
                    fontSize={fontSize}
                    setFontSize={setFontSize}
                    fontFamily={fontFamily}
                    setFontFamily={setFontFamily}
                    focalColor={focalColor}
                    setFocalColor={setFocalColor}
                    sentenceEndDurationMs={sentenceEndDurationMs}
                    setSentenceEndDurationMs={setSentenceEndDurationMs}
                    speechBreakDurationMs={speechBreakDurationMs}
                    setSpeechBreakDurationMs={setSpeechBreakDurationMs}
                    reduceTransparency={reduceTransparency}
                    setReduceTransparency={setReduceTransparency}
                    reduceMotion={reduceMotion}
                    setReduceMotion={setReduceMotion}
                    showKeyboardShortcuts
                  />
                </div>
              </DrawerContent>
            </Drawer>
          )}
        </div>
      </header>

      <main
        className={cn(
          "mx-auto flex max-w-3xl flex-1 flex-col px-4 pt-5 sm:pt-8",
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
              {(article.siteName || article.byline || readingTimeMs > 0) && (
                <p className="mb-2 text-sm text-muted-foreground">
                  {[
                    article.siteName,
                    article.byline,
                    readingTimeMs > 0 ? readingTimeLabel : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
                {article.title ?? "Untitled"}
              </h1>
              {article.excerpt && (
                <p className="mt-3 text-base text-muted-foreground sm:text-lg">
                  {article.excerpt}
                </p>
              )}
              <div
                className={cn(
                  "mt-4 flex w-full print:hidden",
                  !isCompactView && "hidden",
                )}
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
              <div
                ref={articleScrollContainerRef}
                className={cn(
                  "min-h-0 flex-1 flex-col overflow-auto",
                  !isCompactView && "flex-none overflow-visible",
                  isCompactView && !showArticleOnMobile && "hidden print:block",
                )}
              >
                <ArticleBody
                  ref={articleBodyRef}
                  html={
                    wrappedContent ?? processedContent ?? article?.content ?? ""
                  }
                  wordIndex={wordIndex}
                  onWordClick={handleWordClick}
                  onMediaClick={handleMediaClick}
                  scrollToWord={scrollToWordInArticleArea}
                />
              </div>

              {articleText && isCompactView && !showArticleOnMobile && (
                <div className="flex min-h-0 flex-1 flex-col print:hidden">
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
                    focalColor={focalColor}
                    fillHeight
                    className="flex-1 min-h-0 justify-center border-0"
                  />
                </div>
              )}
            </div>
          </article>
        )}

        {!article && !error && !isLoading && (
          <div className="flex flex-col items-center justify-center py-16 text-center sm:py-24">
            <p className="text-muted-foreground">
              Paste an article URL above to extract and read it in a clean,
              focused view.
            </p>
          </div>
        )}
      </main>

      {article && articleText && !isCompactView && (
        <div
          ref={panelRef}
          className="fixed bottom-0 left-0 right-0 z-20 print:hidden"
        >
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
            focalColor={focalColor}
          />
        </div>
      )}

      <Dialog.Root
        open={!!mediaPreview}
        onOpenChange={(open) => !open && setMediaPreview(null)}
      >
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
              "fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border border-white/10 bg-black p-2 focus:outline-none",
              "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            )}
          >
            {mediaPreview?.type === "image" && (
              // eslint-disable-next-line @next/next/no-img-element -- dynamic external URLs from article content
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
