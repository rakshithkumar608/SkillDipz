import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit"
})

export const metadata: Metadata = {
  title: "SkillDipz | Evaluate Your Career",
  description: "AI-powered skill gap analysis and recruitment platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${outfit.variable} font-sans bg-slate-950 text-slate-50 antialiased`}
    >
      <body suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
        
        </body>
    </html>
  );
}
