import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "COVID-19 Country Analytics",
  description:
    "Explore COVID-19 cases, deaths, and vaccinations by country with tables, charts, and maps (Our World in Data).",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Some browser extensions (e.g., Grammarly) inject attributes into <html>/<body>
    // before React hydrates, which can trigger noisy hydration mismatch warnings.
    // We intentionally suppress hydration warnings at the document root to keep
    // the app stable and developer-friendly.
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${inter.variable} ${jetbrainsMono.variable} min-h-screen font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
