import type { ReactNode } from "react";
import Providers from "@/components/Providers";
import { GrowthBookClientProvider } from "@/components/GrowthBookClientProvider";
import { GW_THEME_STORAGE_KEY } from "@/lib/theme-constants";
import "./globals.css";

export const metadata = { title: "GhostWriter AI", description: "AI-powered writing studio" };

const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var t=localStorage.getItem('${GW_THEME_STORAGE_KEY}');if(t!=='light'&&t!=='dark')t='dark';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
        <link
          href="https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,300..700;1,7..72,300..700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-surface-bg text-gray-900 antialiased">
        <Providers>
          <GrowthBookClientProvider>
            {children}
          </GrowthBookClientProvider>
        </Providers>
      </body>
    </html>
  );
}
