import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PaywallMock } from "./PaywallMock";

export const metadata: Metadata = {
  title: "Billing paywall preview",
  robots: { index: false, follow: false },
};

/** Dev-only preview of the no-access paywall per state (?kind=trial_ended|ended|payment_failed|never). */
export default function PaywallMockPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <PaywallMock />;
}