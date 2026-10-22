import Link from "next/link";
import { PUBLIC_FAQ_ITEMS } from "@/lib/public-faq";

export function FaqPageView() {
  return (
    <article className="frontend-legal frontend-legal--long">
      <h1>EMDR App FAQ</h1>
      <p>
        Short answers about sessions, Self-guided sets, the trial, and when to
        get help. For plans, see <Link href="/pricing">Pricing</Link>. For how
        to reach us, see <Link href="/support">Support</Link>.
      </p>

      <dl className="frontend-legal-faq">
        {PUBLIC_FAQ_ITEMS.map((item) => (
          <div key={item.q}>
            <h2>{item.q}</h2>
            {item.q.startsWith("Is my data private") ? (
              <p>
                Sessions are encrypted and never used to train AI models. Read
                the <Link href="/privacy">Privacy Policy</Link> for exactly what
                is stored, where, and for how long.
              </p>
            ) : (
              <p>{item.a}</p>
            )}
          </div>
        ))}
      </dl>

      <p className="frontend-legal-note">
        If a session feels unsafe, stop and read{" "}
        <Link href="/safety">Safety</Link>. Crisis lines are listed there.
      </p>
    </article>
  );
}
