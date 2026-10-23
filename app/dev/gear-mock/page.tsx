import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GearMock } from "./GearMock";

export const metadata: Metadata = {
  title: "Adjustments preview",
  robots: { index: false, follow: false },
};

/** Dev-only: the Adjustments sheet with local state (no session, no API). */
export default function GearMockPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <GearMock />;
}