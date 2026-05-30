import type { ReactNode } from "react";
import Providers from "@/components/Providers";
import { GrowthBookClientProvider } from "@/components/GrowthBookClientProvider";
import "./globals.css";

export const metadata = { title: "GhostWriter AI", description: "AI-powered writing studio" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
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
