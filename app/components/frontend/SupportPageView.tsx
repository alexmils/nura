import Link from "next/link";
import {
  BRAND_LIMITS_LINE,
  BRAND_SPOKEN,
  BRAND_SUPPORT_EMAIL,
} from "@/lib/brand";

export function SupportPageView() {
  return (
    <article className="frontend-legal frontend-legal--long">
      <h1>Support — Get Help With Your Account</h1>
      <p>
        Product questions about {BRAND_SPOKEN} — accounts, billing, and how a
        session works. For clinical crisis help, use the lines below, not email.
      </p>

      <h2>In the app</h2>
      <p>
        Open <strong>Need help</strong> from any signed-in screen. The chat
        answers common questions and can pass a message to the team when needed.
      </p>

      <h2>Email</h2>
      <p>
        Write to{" "}
        <a href={`mailto:${BRAND_SUPPORT_EMAIL}`}>{BRAND_SUPPORT_EMAIL}</a>. We read every
        message; reply times vary.
      </p>

      <h2>Also useful</h2>
      <ul>
        <li>
          <Link href="/faq">FAQ</Link> — sessions, Free sets, trial, privacy
        </li>
        <li>
          <Link href="/pricing">Pricing</Link> — weekly, monthly, and yearly
          plans
        </li>
        <li>
          <Link href="/safety">Safety</Link> — when to stop and get help
        </li>
        <li>
          <Link href="/limits">Limits</Link> — what the app does not do
        </li>
      </ul>

      <p className="frontend-legal-note">
        <strong>If you are in danger right now, do not wait on email.</strong>{" "}
        In the US, call or text <a href="tel:988">988</a> (Suicide &amp; Crisis
        Lifeline). Anywhere, call your local emergency number.
      </p>

      <p className="frontend-legal-note">{BRAND_LIMITS_LINE}</p>
    </article>
  );
}
