"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { closeAllEditors } from "@/app/components/frontend/section-editor/SectionEdit";
import { AccessibilityWidget } from "@/app/components/AccessibilityWidget";
import { HelpChatWidget } from "@/app/components/HelpChatWidget";
import { FrontendBackToTop } from "@/app/components/frontend/FrontendBackToTop";
import { FrontendFooter } from "@/app/components/frontend/FrontendFooter";
import { FrontendHeader } from "@/app/components/frontend/FrontendHeader";
import { FrontendPreloader } from "@/app/components/frontend/FrontendPreloader";
import "./frontend-fonts.css";
import "./frontend-buttons.css";
import "./frontend-help.css";
import "./section-editor/section-editor.css";

function EditorRouteReset() {
  const pathname = usePathname();
  const last = useRef(pathname);
  useEffect(() => {
    if (last.current === pathname) return;
    last.current = pathname;
    closeAllEditors();
  }, [pathname]);
  return null;
}

export function FrontendShellClient({
  children,
  wide = false,
  marketingExtras,
}: {
  children: ReactNode;
  wide?: boolean;
  marketingExtras?: ReactNode;
}) {
  return (
    <div className={`frontend-home${wide ? " frontend-home-landing" : ""}`}>
      <EditorRouteReset />
      <FrontendPreloader />
      <FrontendHeader overlay={wide} />
      <main
        className={wide ? "frontend-main frontend-main-wide" : "frontend-main"}
      >
        {children}
      </main>
      <FrontendFooter />
      <FrontendBackToTop />
      <HelpChatWidget showFab />
      {/* Marketing docks the ribbon left: the help pill and back-to-top own the right. */}
      <AccessibilityWidget defaultEdge="left" />
      {marketingExtras}
    </div>
  );
}
