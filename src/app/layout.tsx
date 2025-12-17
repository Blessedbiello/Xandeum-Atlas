import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Xandeum Atlas - pNode Analytics",
  description: "Real-time analytics platform for Xandeum pNode network",
  keywords: ["Xandeum", "pNode", "Solana", "storage", "analytics", "blockchain"],
  authors: [{ name: "Xandeum Community" }],
  openGraph: {
    title: "Xandeum Atlas - pNode Analytics",
    description: "Real-time analytics platform for Xandeum pNode network",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
