"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  applyConsentToGtag,
  isGtmAllowedPath,
  readConsent,
} from "@/lib/marketing-consent";
import { captureAttribution } from "@/lib/attribution";
import type { PublicMarketingTags } from "@/lib/site-seo-types";

function isPublicMarketingTags(value: unknown): value is PublicMarketingTags {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.ga4MeasurementId === "string" &&
    typeof v.gtmId === "string" &&
    typeof v.clarityId === "string" &&
    typeof v.skipAnalytics === "boolean" &&
    typeof v.checkIgnoreIps === "boolean"
  );
}

/**
 * GA4, GTM, and Clarity load on marketing pages with consent defaults denied.
 * Tag IDs are fetched live from `/api/marketing/tags` so ISR HTML (often built
 * without DB) never ships empty measurement IDs after deploy.
 */
export function MarketingTags({ tags }: { tags: PublicMarketingTags }) {
  const pathname = usePathname() || "/";
  const allowed = isGtmAllowedPath(pathname);
  const [liveTags, setLiveTags] = useState(tags);
  const [tagsReady, setTagsReady] = useState(false);
  const [ipSkip, setIpSkip] = useState(tags.skipAnalytics);
  const [ipChecked, setIpChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/marketing/tags")
      .then((res) => res.json())
      .then((data: unknown) => {
        if (!cancelled && isPublicMarketingTags(data)) {
          setLiveTags(data);
        }
      })
      .catch(() => {
        /* keep server-provided tags */
      })
      .finally(() => {
        if (!cancelled) setTagsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    applyConsentToGtag(readConsent());
  }, []);

  // Keep the ad click alive past this page load. `_ga` is written a moment
  // after gtag.js boots, and that client_id is what lets the Stripe webhook
  // report a purchase days later, so capture twice.
  useEffect(() => {
    const capture = () => {
      const choice = readConsent();
      captureAttribution(
        choice ? { analytics: choice.analytics, marketing: choice.marketing } : undefined
      );
    };
    capture();
    const timer = setTimeout(capture, 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!tagsReady) return;
    if (!liveTags.checkIgnoreIps) {
      setIpSkip(liveTags.skipAnalytics);
      setIpChecked(true);
      return;
    }
    let cancelled = false;
    fetch("/api/marketing/analytics-gate")
      .then((res) => res.json() as Promise<{ skip?: boolean }>)
      .then((data) => {
        if (!cancelled) {
          setIpSkip(data.skip === true);
          setIpChecked(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIpSkip(false);
          setIpChecked(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tagsReady, liveTags.checkIgnoreIps, liveTags.skipAnalytics]);

  if (!tagsReady || !ipChecked || ipSkip || liveTags.skipAnalytics || !allowed) {
    return null;
  }

  return (
    <>
      <Script id="nura-consent-default" strategy="afterInteractive">{`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        window.gtag = gtag;
        gtag('consent', 'default', {
          analytics_storage: 'denied',
          ad_storage: 'denied',
          ad_user_data: 'denied',
          ad_personalization: 'denied',
          wait_for_update: 500
        });
      `}</Script>

      {liveTags.ga4MeasurementId ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${liveTags.ga4MeasurementId}`}
            strategy="afterInteractive"
          />
          <Script id="nura-ga4" strategy="afterInteractive">{`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            window.gtag = gtag;
            gtag('js', new Date());
            gtag('config', '${liveTags.ga4MeasurementId}', {
              anonymize_ip: true,
              send_page_view: true
            });
          `}</Script>
        </>
      ) : null}

      {liveTags.gtmId ? (
        <Script id="nura-gtm" strategy="afterInteractive">{`
          (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','${liveTags.gtmId}');
        `}</Script>
      ) : null}

      {liveTags.clarityId ? (
        <Script
          id="nura-clarity"
          strategy="afterInteractive"
          onReady={() => applyConsentToGtag(readConsent())}
        >{`
          (function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "${liveTags.clarityId}");
        `}</Script>
      ) : null}
    </>
  );
}
