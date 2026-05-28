import type { ReactNode } from "react";
import Providers from "@/components/Providers";
import "./globals.css";

export const metadata = { title: "GhostWriter AI", description: "AI-powered writing studio" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-surface-bg text-gray-900 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
