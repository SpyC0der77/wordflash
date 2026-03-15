import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "About | WordFlash",
  description:
    "Learn how WordFlash uses RSVP (Rapid Serial Visual Presentation) to speed up your reading.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-10 sm:px-8">
      <Button variant="ghost" size="icon" asChild className="mb-8 self-start">
        <Link href="/" aria-label="Back to home">
          <ArrowLeft className="size-5" />
        </Link>
      </Button>

      <article className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          How WordFlash speeds up reading
        </h1>

        <p className="lead text-lg text-muted-foreground">
          WordFlash uses a technique called <strong>RSVP</strong>—Rapid Serial
          Visual Presentation—to help you read faster by eliminating eye
          movement and focusing your attention on one word at a time.
        </p>

        <section className="space-y-3">
          <h2 className="mt-10 text-xl font-semibold">What is RSVP?</h2>
          <p className="leading-7 text-muted-foreground">
            <strong>Rapid Serial Visual Presentation</strong> (RSVP) is a
            reading method that displays words one at a time in a fixed position
            on the screen. Instead of scanning left-to-right across lines and
            jumping your eyes from line to line, you keep your gaze steady while
            words stream to you. This removes the physical limits of traditional
            reading—saccades (eye jumps) and fixations (pauses on each
            word)—which typically cap reading speed around 200–250 words per
            minute.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="mt-10 text-xl font-semibold">
            Why RSVP speeds up reading
          </h2>
          <p className="leading-7 text-muted-foreground">
            When you read normally, your eyes spend time moving between words
            and lines. Each movement and refocus costs time. RSVP eliminates
            that by:
          </p>
          <ul className="my-4 list-disc space-y-2 pl-6">
            <li>
              <strong>Removing saccades</strong> — Your eyes stay fixed; words
              come to you instead of you chasing them.
            </li>
            <li>
              <strong>Reducing subvocalization</strong> — The steady pace
              encourages you to process words visually rather than “sounding
              them out” in your head.
            </li>
            <li>
              <strong>Maintaining focus</strong> — One word at a time reduces
              distractions and keeps your attention centered.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="mt-10 text-xl font-semibold">
            Focal character highlighting
          </h2>
          <p className="leading-7 text-muted-foreground">
            WordFlash adds a refinement: the <strong>focal character</strong>.
            The middle letter of each word is highlighted in a distinct color
            (rose, blue, green, or amber). This gives your eye a precise anchor
            point—the optimal viewing position (OVP) for each word—so you can
            recognize words faster without scanning left-to-right within the
            word itself.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="mt-10 text-xl font-semibold">Getting started</h2>
          <p className="leading-7 text-muted-foreground">
            Paste text on the home page or enter an article URL in the{" "}
            <Link
              href="/reader"
              className="text-primary underline underline-offset-4 hover:opacity-80"
            >
              Article Reader
            </Link>
            . Press play, focus on the highlighted letter, and adjust the
            words-per-minute (WPM) until you find a comfortable pace. Most
            people can reach 300–400 WPM with practice; some go much higher.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="mt-10 text-xl font-semibold">Further reading</h2>
          <p className="leading-7 text-muted-foreground">
            For more information, see:
          </p>
          <ul className="space-y-3 text-muted-foreground">
            <li>
              <Link
                href="https://en.wikipedia.org/wiki/Rapid_serial_visual_presentation"
                target="_blank"
                className="text-primary underline underline-offset-4 hover:opacity-80"
              >
                Rapid Serial Visual Presentation on Wikipedia
              </Link>
            </li>
          </ul>
        </section>
      </article>
    </div>
  );
}
