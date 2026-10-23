import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FrontendShell } from "@/app/components/frontend/FrontendShell";
import { HomeLandingV2 } from "@/app/components/frontend/HomeLandingV2";
import { getLandingBlogPosts } from "@/lib/landing-blog-server";
import { CtaDraft } from "./CtaDraft";

export const metadata: Metadata = {
  title: "Closing CTA preview",
  robots: { index: false, follow: false },
};

/**
 * Dev-only: the real home page with the closing CTA switched to another
 * template through a local draft (nothing is saved).
 * `?tpl=<template>` picks the look; `&bg=0` drops the saved background.
 */
export default async function CtaMockPage({
  searchParams,
}: {
  searchParams: Promise<{ tpl?: string; bg?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { tpl = "meadow", bg } = await searchParams;
  const blogPosts = await getLandingBlogPosts(20);
  return (
    <FrontendShell wide>
      <CtaDraft template={tpl} dropBackground={bg === "0"} />
      <HomeLandingV2 blogPosts={blogPosts} />
    </FrontendShell>
  );
}
