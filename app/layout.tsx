import type { Metadata } from "next";
import { Fraunces, Roboto_Mono, Source_Sans_3 } from "next/font/google";
import {
  BRAND_DESCRIPTION,
  BRAND_LEGAL,
  BRAND_SPOKEN,
  BRAND_TITLE,
  brandMetadataBase,
} from "@/lib/brand";
import { a11yBootstrapScript } from "@/lib/a11y-preferences";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
  // Soft/wonky axes — organic like the wave; distinct from condensed Caslon
  axes: ["SOFT", "WONK", "opsz"],
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-source-sans",
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
      className={`${sourceSans.variable} ${fraunces.variable} ${robotoMono.variable}`}
    >
      <head>
        {/*
          Saved accessibility choices (text size, contrast, motion) must apply
          before first paint, otherwise the page flashes at the wrong size.
        */}
        <script
          dangerouslySetInnerHTML={{ __html: a11yBootstrapScript() }}
        />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
