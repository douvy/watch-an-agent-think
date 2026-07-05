import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

// Display voice — serif italic for headlines and verdicts, the human
// register against the machine mono. The Zed move.
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

const description =
  "Three agent runs on a scrubbable timeline — planning, tool calls, failure, recovery, context pressure. No model behind this page; every run is a script you can scrub.";

export const metadata: Metadata = {
  metadataBase: new URL("https://watch-an-agent-think.vercel.app"),
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
        className={`${inter.variable} ${jetbrainsMono.variable} ${instrumentSerif.variable} font-sans`}
      >
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  );
}
