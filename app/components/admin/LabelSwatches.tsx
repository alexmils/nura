"use client";

import { Check } from "lucide-react";
import { LABEL_COLORS } from "@/lib/media-label-colors";

/** A row of label colour swatches; the chosen one gets a ring and a check. */
export function LabelSwatches({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Label colour">
      {LABEL_COLORS.map((c) => {
        const on = c.key === value;
        return (
          <button
            key={c.key}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={c.name}
            title={c.name}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChange(c.key)}
            className={`inline-flex size-5 items-center justify-center rounded-full border transition-transform duration-200 hover:scale-110 ${
              on ? "ring-2 ring-[#1B2F0C] ring-offset-1 ring-offset-[#F7F6F1]" : ""
            }`}
            style={{ background: c.dot, borderColor: c.border }}
          >
            {on ? <Check size={10} strokeWidth={3} color={c.key === "default" ? "#1B2F0C" : "#fff"} /> : null}
          </button>
        );
      })}
    </div>
  );
}
