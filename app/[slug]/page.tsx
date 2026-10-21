import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/app/app/login/page";
import { gateSlugMatches } from "@/lib/login-guard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

/**
 * Private staff sign-in. The admin types the path in Admin → Security; every
 * other root slug 404s, so the address is never linked or discoverable.
 */
export default async function OperatorSignInPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!(await gateSlugMatches(slug))) notFound();

  return (
    <Suspense>
      <LoginForm adminGate={slug} />
    </Suspense>
  );
}
