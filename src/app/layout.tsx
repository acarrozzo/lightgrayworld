import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import FontPreferenceApplier from "@/components/FontPreferenceApplier";
import ThemeApplier from "@/components/ThemeApplier";
import { DEFAULT_THEME_ID, THEME_IDS } from "@/lib/theme/themes";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Light Gray RPG",
  description: "A modern, real-time multiplayer text-based RPG built with Next.js, TypeScript, and Socket.io.",
};

export const viewport: Viewport = {
  viewportFit: "cover",
};

/*
 * Applies the stored terminal theme before first paint.
 *
 * This runs synchronously in <head>, ahead of hydration, so a player who chose
 * Gruvbox never sees a frame of Light Gray first. It is inlined rather than
 * imported because any module boundary would push it past the first paint,
 * which is the entire thing it exists to beat. The allowed ids are baked in so
 * a tampered local-storage value cannot put arbitrary text into the attribute.
 */
const themeBootstrap = `
(function () {
  try {
    var allowed = ${JSON.stringify(THEME_IDS)};
    var stored = window.localStorage.getItem('lg:theme');
    var theme = allowed.indexOf(stored) === -1 ? '${DEFAULT_THEME_ID}' : stored;
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', '${DEFAULT_THEME_ID}');
  }
})();
`.trim();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme={DEFAULT_THEME_ID}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased font-regular`}
      >
        <ThemeApplier />
        <FontPreferenceApplier />
        {children}
      </body>
    </html>
  );
}
