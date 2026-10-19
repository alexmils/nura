import type { Metadata } from "next";
import {
  Fraunces,
  Instrument_Sans,
  Roboto_Mono,
  Source_Sans_3,
} from "next/font/google";
import {
  BRAND_DESCRIPTION,
  BRAND_LEGAL,
  BRAND_SPOKEN,
  BRAND_TITLE,
  brandMetadataBase,
} from "@/lib/brand";
import { a11yBootstrapScript } from "@/lib/a11y-preferences";
import { consentDefaultScript } from "@/lib/marketing-consent";
import { MotionProvider } from "@/app/components/motion/MotionProvider";
import { PageTransitionOverlay } from "@/app/components/motion/PageTransitionOverlay";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
  // Soft/wonky axes — organic like the wave; distinct from condensed Caslon
  axes: ["SOFT", "WONK", "opsz"],
  style: ["normal", "italic"],
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-source-sans",
});

/** Display sans for the landing v2 hero and section titles. */
const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-instrument",
});

/** Labels / kickers on `.frontend-home` (mono; does not compete with wave lockup). */
const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
  variable: "--font-fe-alt",
});

export const metadata: Metadata = {
  metadataBase: brandMetadataBase(),
  title: {
    default: BRAND_TITLE,
    template: `%s — ${BRAND_SPOKEN}`,
  },
  description: BRAND_DESCRIPTION,
  icons: {
    icon: [{ url: "/brand-assets/favicon", type: "image/png" }],
    apple: [{ url: "/brand-assets/favicon" }],
  },
  openGraph: {
    title: BRAND_TITLE,
    description: BRAND_DESCRIPTION,
    siteName: BRAND_LEGAL,
    type: "website",
    images: [{ url: "/brand/lockup.png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sourceSans.variable} ${fraunces.variable} ${robotoMono.variable} ${instrumentSans.variable}`}
    >
      <head>
        {/*
          One inline script, not two. React 19 matches head scripts by
          position and a second tag hydrates onto the first.
          suppressHydrationWarning: tag blockers rewrite this script's text
          before React starts, which otherwise fails hydration and blocks Edit.
          Consent Mode still runs first, then saved accessibility choices.
        */}
        <script
          id="nura-early-bootstrap"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `${consentDefaultScript()}\n${a11yBootstrapScript()}`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <MotionProvider>
          {children}
          <PageTransitionOverlay />
        </MotionProvider>
      </body>
    </html>
  );
}
