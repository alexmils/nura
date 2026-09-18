"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { appPath } from "@/lib/app-base";
import { LetterRevealHeading } from "./LetterRevealHeading";
import "./home-pause-cta.css";

export function HomePauseCta() {
  return (
    <section className="fe-pause" aria-labelledby="fe-pause-title">
      <div className="fe-container fe-pause-frame">
        <LetterRevealHeading id="fe-pause-title" className="fe-pause-title">
          The session starts when you do.
        </LetterRevealHeading>
        <Link
          href={appPath("/create-account")}
          className="fe-pause-cta fe-animate"
        >
          Get started
          <Plus size={16} strokeWidth={2} aria-hidden />
        </Link>
      </div>
    </section>
  );
}
