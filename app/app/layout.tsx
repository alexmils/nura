import type { Metadata } from "next";
import { AccessibilityWidget } from "@/app/components/AccessibilityWidget";
import { AppAccessGate } from "@/app/components/AppAccessGate";
import { FeedbackPromptHost } from "@/app/components/FeedbackPromptHost";
import { HelpChatWidget } from "@/app/components/HelpChatWidget";
import { ToastProvider } from "@/app/components/Toast";
import { BRAND_PRODUCT, BRAND_SPOKEN } from "@/lib/brand";

/** Console under /app — do not index; do not reuse frontend OG url. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  openGraph: {
    url: "/app",
    title: BRAND_SPOKEN,
    description: `${BRAND_PRODUCT} sessions`,
  },
};

export default function AppConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
      <AppAccessGate>
        <ToastProvider>
          {children}
          <FeedbackPromptHost />
          <HelpChatWidget showFab />
          <AccessibilityWidget />
        </ToastProvider>
      </AppAccessGate>
  );
}
