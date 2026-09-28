import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { AnalyticsProvider } from "@/components/posthog-provider";
import { SaaSMakerFeedback } from "@/components/saasmaker-feedback";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://mention.highsignal.app"),
  title: "MentionPilot",
  description: "AI Visibility Monitoring for Startups",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "MentionPilot",
    title: "MentionPilot",
    description: "AI Visibility Monitoring for Startups",
    url: "/",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "MentionPilot",
    description: "AI Visibility Monitoring for Startups",
    images: ["/og-image.png"],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "MentionPilot",
  url: "https://mention.highsignal.app",
  description: "AI Visibility Monitoring for Startups",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html:
              'var __name = (target, value) => Object.defineProperty(target, "name", { value, configurable: true });',
          }}
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <AnalyticsProvider>
            {children}
            <SaaSMakerFeedback />
          </AnalyticsProvider>
        </ThemeProvider>
        <Script
          id="app-health-tracker"
          src="https://health.sassmaker.com/tracker.js"
          strategy="afterInteractive"
          data-key="ahk_pub_b98ea89981e7bbb4c2301e476a030aa08459593907568ae8175683af9458d102"
          data-project="app-import-c47b0daf38fb4608873f1d0cd8a30d66f00b2d479a9770dbbf8c8aeb26075168"
          data-identity="persistent"
          data-endpoint="https://ingest.sassmaker.com/v1/browser"
        />
        <Script id="app-health-events" src="/app-health-events.js" strategy="afterInteractive" />
        <Script id="app-health-log" src="/app-health-log.js" strategy="lazyOnload" />
        <Script id="microsoft-clarity" strategy="lazyOnload">
          {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/yoigmcwti8";y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","yoigmcwti8");window.clarity("set","project_id","mentionpilot");`}
        </Script>
      </body>
    </html>
  );
}
