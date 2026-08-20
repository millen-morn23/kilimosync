import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "KilimoSync | Connecting Kenyan Farmers With Buyers",
    template: "%s | KilimoSync",
  },
  description:
    "KilimoSync connects farmers directly with buyers, making fresh produce easier to sell, discover and purchase — with M-PESA payments built in.",
  openGraph: {
    title: "KilimoSync | Connecting Kenyan Farmers With Buyers",
    description:
      "KilimoSync connects farmers directly with buyers, making fresh produce easier to sell, discover and purchase.",
    siteName: "KilimoSync",
    locale: "en_KE",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
