import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VoiceOrbPicker } from "@/app/components/admin/VoiceOrbPicker";

export const metadata: Metadata = {
  title: "Voice orb picker preview",
  robots: { index: false, follow: false },
};

/** Dev-only: the Admin -> Platform -> Voice orb grid outside the admin shell. Saving needs an admin session. */
export default function OrbPickerMockPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <VoiceOrbPicker />
    </main>
  );
}