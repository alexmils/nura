import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ThinkingMock } from "./ThinkingMock";

export const metadata: Metadata = {
  title: "Thinking indicator preview",
  robots: { index: false, follow: false },
};

/** Dev-only preview of the guide's thinking indicator in the session transcript (no API, no DB). */
export default function ThinkingMockPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense fallback={null}>
      <ThinkingMock />
    </Suspense>
  );
}
