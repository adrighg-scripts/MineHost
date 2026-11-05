import { headers } from "next/headers";
import { LanguageProvider } from "./language";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MineHost · Cross-Platform Server Control",
  description: "Dein Minecraft-Server für Android, Windows, Linux/Ubuntu & iOS. Von überall verwalten.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MineHost",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = await headers();
  const preference = requestHeaders.get("cookie")?.match(/(?:^|;\s*)minehost_language=(auto|de|en)(?:;|$)/)?.[1] as "auto" | "de" | "en" | undefined;
  const language = (requestHeaders.get("accept-language") || "en").toLowerCase().startsWith("de") ? "de" : "en";
  return (
    <html lang={preference && preference !== "auto" ? preference : language}>
      <body className="antialiased"><LanguageProvider initialLocale={language} initialChoice={preference || "auto"}>{children}</LanguageProvider></body>
    </html>
  );
}
