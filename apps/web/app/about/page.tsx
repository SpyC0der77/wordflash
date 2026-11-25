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
          WordFlash shows text one word at a time in a fixed spot, so your eyes
          stay still while the words come to you. Paste text or open an article,
          pick a pace, and press play.
        </p>

        <section className="space-y-3">
          <h2 className="mt-10 text-xl font-semibold">How it works</h2>
          <p className="leading-7 text-muted-foreground">
            The method is called rapid serial visual presentation (RSVP). Each
            word is aligned on a highlighted letter that never moves, giving
            your gaze a steady anchor. WordFlash pauses at punctuation and gives
            long words, numbers, and unfamiliar names a little extra time.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="mt-10 text-xl font-semibold">Finding your pace</h2>
          <p className="leading-7 text-muted-foreground">
            Speed only helps if you still understand what you read. Start
            slow, speed up as it feels easy, and pause or step back whenever
            you lose the thread.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="mt-10 text-xl font-semibold">Reading articles</h2>
          <p className="leading-7 text-muted-foreground">
            Enter a URL in the{" "}
            <Link
              href="/reader"
              className="text-primary underline underline-offset-4 hover:opacity-80"
            >
              Article Reader
            </Link>{" "}
            to follow along in the full text. The current word stays
            highlighted, and clicking any word jumps to it.
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
