import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SessionHeaderMock } from "./SessionHeaderMock";

export const metadata: Metadata = {
  title: "Session header preview",
  robots: { index: false, follow: false },
};

/** Dev-only preview of the calm session header + transcript phase badges (no API). */
export default function SessionHeaderMockPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense>
      <SessionHeaderMock />
    </Suspense>
  );
}
