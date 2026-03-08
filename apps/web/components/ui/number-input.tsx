"use client";

import { Button } from "@/components/ui/button";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  className?: string;
}

export function NumberInput({
  value,
  onChange,
  min = 0,
  max = Infinity,
  step = 1,
  unit,
  className,
}: NumberInputProps) {
  const increment = () => onChange(Math.min(max, value + step));
  const decrement = () => onChange(Math.max(min, value - step));
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const num = parseInt(e.target.value, 10);
    if (!Number.isNaN(num)) {
      onChange(Math.min(max, Math.max(min, num)));
    }
  };

  return (
    <div
      className={cn(
        "flex items-center border rounded-lg bg-background shadow-xs dark:bg-input/30 dark:border-input w-fit overflow-hidden",
        className
      )}
    >
      <Button
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
          value={value}
          onChange={handleInputChange}
          min={min}
          max={max}
          className="w-14 bg-transparent text-center font-semibold focus:outline-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-moz-number-spin-up]:hidden [&::-moz-number-spin-down]:hidden"
        />
        {unit && (
          <span className="text-xs text-muted-foreground">{unit}</span>
        )}
      </div>

      <Button
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
