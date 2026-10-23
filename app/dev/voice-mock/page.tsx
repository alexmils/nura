import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VoiceMock } from "./VoiceMock";

export const metadata: Metadata = {
  title: "Voice stage preview",
  robots: { index: false, follow: false },
};

/** Dev-only preview of the portrait voice stage in each state (no mic, no API). */
export default function VoiceMockPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <VoiceMock />;
}
