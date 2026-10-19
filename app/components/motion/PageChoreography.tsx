"use client";

import { usePathname } from "next/navigation";
import { buildPageChoreography, useChoreography } from "./choreography";

/** Home is wired by hand (`useHomeChoreography`); the signed-in app has none. */
export function pageGetsChoreography(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname !== "/" && !pathname.startsWith("/app") && !pathname.startsWith("/admin");
}

/** Automatic scroll choreography for the public pages (mounted once in the shell). */
export function PageChoreography() {
  const pathname = usePathname();
  useChoreography(
    () => document.querySelector<HTMLElement>("main.frontend-main"),
    buildPageChoreography,
    pathname ?? "",
    pageGetsChoreography(pathname)
  );
  return null;
}