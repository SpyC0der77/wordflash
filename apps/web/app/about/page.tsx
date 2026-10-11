import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "About | WordFlash",
  description:
    "WordFlash shows text one word at a time, with a highlighted letter to keep your place and a reading pace you control.",
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
          About WordFlash
        </h1>

        <p className="text-lg leading-7 text-muted-foreground">
          WordFlash shows text one word at a time in the same spot on screen.
          Paste something you want to read or open an article by URL, then set
          the pace in words per minute. A highlighted letter in each word gives
          you a place to rest your gaze.
        </p>

        <section className="space-y-3">
          <h2 className="mt-10 text-xl font-semibold">Reading one word at a time</h2>
          <p className="leading-7 text-muted-foreground">
            This method is called rapid serial visual presentation, or RSVP.
            The words change while their position stays fixed, so you can read
            without scanning across lines. WordFlash adds pauses at punctuation
            and gives longer words, numbers, and unfamiliar names extra time.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="mt-10 text-xl font-semibold">
            Choosing a pace
          </h2>
          <p className="leading-7 text-muted-foreground">
            Start at a speed that lets you follow the meaning. Increase it when
            reading feels comfortable, and slow down for dense or unfamiliar
            material. A higher words-per-minute setting only helps if you can
            still understand what you read. Pause or go back whenever you need
            to reread a passage.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="mt-10 text-xl font-semibold">
            The highlighted letter
          </h2>
          <p className="leading-7 text-muted-foreground">
            WordFlash aligns each word around its highlighted letter. Short
            words use a letter near the start, while longer words use one
            further in. That letter stays in the same place as the words change,
            giving your eyes a consistent point to follow.
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
            . Press play to begin. The Article Reader highlights the current word
            in the article; in compact view, switch between the article and speed
            reader. Click a word to jump to it.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="mt-10 text-xl font-semibold">Further reading</h2>
          <ul className="space-y-3 text-muted-foreground">
            <li>
              <Link
                href="https://en.wikipedia.org/wiki/Rapid_serial_visual_presentation"
                target="_blank"
                rel="noopener noreferrer"
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
