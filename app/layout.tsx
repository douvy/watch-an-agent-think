import type { Metadata } from "next";
import { Inter, JetBrains_Mono, IBM_Plex_Serif } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

// The agent's voice — narration in the hero, thoughts and verdicts in the
// terminal (italic). One speaker, one serif, against the machine mono.
const plexSerif = IBM_Plex_Serif({
  variable: "--font-plex-serif",
  weight: ["400", "500"],
  style: ["normal", "italic"],
  subsets: ["latin"],
});

const description =
  "Three agent runs on a scrubbable timeline: planning, tool calls, failure, recovery, context pressure. No model behind this page; every run is a hand-written script.";

export const metadata: Metadata = {
  metadataBase: new URL("https://howagentsthink.com"),
  title: "Watch How an AI Agent Thinks",
  description,
  openGraph: {
    title: "Watch How an AI Agent Thinks",
    description,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Watch How an AI Agent Thinks",
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
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} ${plexSerif.variable} font-sans`}
      >
        <main className="min-h-screen">{children}</main>
        {/* Vercel-only: the insights script is served by their edge, so
            local/CI builds would 404 it and fail the smoke run */}
        {process.env.VERCEL === "1" && <Analytics />}
      </body>
    </html>
  );
}
