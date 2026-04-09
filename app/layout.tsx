import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import ThemeProvider from "@/components/ThemeProvider";
import { GA_ID } from "@/lib/gtag";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const NAVER_ANALYTICS_ID = process.env.NEXT_PUBLIC_NAVER_ANALYTICS_ID ?? '';

export const metadata: Metadata = {
  title: '언니픽 슈퍼어드민',
  description: '언니픽 슈퍼어드민 관리자 페이지',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* ── Google Analytics 4 ── */}
        {GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_ID}', { page_path: window.location.pathname });
              `}
            </Script>
          </>
        )}

        {/* ── 네이버 애널리틱스 ── */}
        {NAVER_ANALYTICS_ID && (
          <Script id="naver-analytics-init" strategy="afterInteractive">
            {`
              if(!wcs_add) var wcs_add = {};
              wcs_add["wa"] = "${NAVER_ANALYTICS_ID}";
              if(window.wcs) { wcs.inflow(); wcs_do(wcs_add); }
            `}
          </Script>
        )}
        {NAVER_ANALYTICS_ID && (
          <Script
            src="//wcs.naver.net/wcslog.js"
            strategy="afterInteractive"
            onLoad={() => {
              if (typeof window !== 'undefined' && window.wcs_add) {
                window.wcs?.inflow();
                // @ts-ignore
                window.wcs_do?.(window.wcs_add);
              }
            }}
          />
        )}
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
