import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-linear-to-b from-background via-background to-muted/30 px-4">
      <div className="text-center">
        <p className="text-6xl font-bold text-muted-foreground/50">404</p>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight md:text-3xl">
          Page not found
        </h1>
        <p className="mt-2 text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="mt-8 flex justify-center">
          <Button asChild>
            <Link href="/" className="gap-2">
              <Home className="size-4" />
              Back to Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
