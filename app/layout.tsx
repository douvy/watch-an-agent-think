import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const description =
  "Three agent runs on a scrubbable timeline — planning, tool calls, failure, recovery, context pressure. No model behind this page; every run is a script you can scrub.";

export const metadata: Metadata = {
  metadataBase: new URL("https://watch-an-agent-think.vercel.app"),
  title: "Watch an AI Agent Think",
  description,
  openGraph: {
    title: "Watch an AI Agent Think",
    description,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Watch an AI Agent Think",
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans`}>
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  );
}
