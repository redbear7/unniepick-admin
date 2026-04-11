'use client';

import Script from 'next/script';

export default function NaverAnalytics({ id }: { id: string }) {
  if (!id) return null;
  return (
    <>
      <Script id="naver-analytics-init" strategy="afterInteractive">
        {`
          if(!wcs_add) var wcs_add = {};
          wcs_add["wa"] = "${id}";
          if(window.wcs) { wcs.inflow(); wcs_do(wcs_add); }
        `}
      </Script>
      <Script
        src="//wcs.naver.net/wcslog.js"
        strategy="afterInteractive"
        onLoad={() => {
          if (typeof window !== 'undefined' && (window as any).wcs_add) {
            (window as any).wcs?.inflow();
            (window as any).wcs_do?.((window as any).wcs_add);
          }
        }}
      />
    </>
  );
}
