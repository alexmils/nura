import Link from "next/link";
import type { CSSProperties } from "react";
import type { BlogCtaData } from "@/lib/blog-cta";

/**
 * One CTA inside a guide. The four templates share the copy; only layout and
 * default colours change. Inline colours come from the validated hex values in
 * `lib/blog-cta.ts`.
 */
export function BlogCta({ data }: { data: BlogCtaData }) {
  const style: CSSProperties = {};
  if (data.background) style.background = data.background;
  if (data.text) style.color = data.text;

  const button =
    data.button && data.href ? (
      <Link href={data.href} className="blog-cta-button">
        {data.button}
      </Link>
    ) : null;

  return (
    <section className={`blog-cta blog-cta--${data.template}`} style={style}>
      <div className="blog-cta-copy">
        <p className="blog-cta-title">{data.title}</p>
        {data.body ? <p className="blog-cta-body">{data.body}</p> : null}
      </div>
      {button}
    </section>
  );
}
