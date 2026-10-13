"use client";

import { Button } from "@/components/ui/button";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  className?: string;
  label?: string;
}

export function NumberInput({
  value,
  onChange,
  min = 0,
  max = Infinity,
  step = 1,
  unit,
  className,
  label = "Value",
}: NumberInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    const num = draft === null || draft.trim() === "" ? value : Number(draft);
    if (Number.isFinite(num)) {
      onChange(Math.min(max, Math.max(min, Math.round(num))));
    }
    setDraft(null);
  };
  const increment = () => {
    setDraft(null);
    onChange(Math.min(max, value + step));
  };
  const decrement = () => {
    setDraft(null);
    onChange(Math.max(min, value - step));
  };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDraft(e.target.value);
  };

  return (
    <div
      className={cn(
        "flex items-center border rounded-lg bg-background shadow-xs dark:bg-input/30 dark:border-input w-fit overflow-hidden",
        className
      )}
    >
      <Button
        type="button"
        aria-label={`Decrease ${label.toLowerCase()}`}
        onClick={decrement}
        variant="ghost"
        size="sm"
        disabled={value <= min}
        className="h-10 px-3 rounded-none hover:bg-accent hover:border-none"
      >
        <Minus className="h-4 w-4" />
      </Button>

      <div className="flex items-baseline justify-center gap-0.5 border-x border-input bg-transparent px-3 py-2">
        <input
          type="number"
          inputMode="numeric"
          aria-label={label}
          value={draft ?? value}
          onChange={handleInputChange}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") { event.preventDefault(); commit(); }
            if (event.key === "Escape") { event.preventDefault(); setDraft(null); }
          }}
          min={min}
          max={max}
          className="w-14 bg-transparent text-center font-semibold focus:outline-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-moz-number-spin-up]:hidden [&::-moz-number-spin-down]:hidden"
        />
        {unit && (
          <span className="text-xs text-muted-foreground">{unit}</span>
        )}
      </div>

      <Button
        type="button"
        aria-label={`Increase ${label.toLowerCase()}`}
        onClick={increment}
        variant="ghost"
        size="sm"
        disabled={value >= max}
        className="h-10 px-3 rounded-none hover:bg-accent hover:border-none"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
