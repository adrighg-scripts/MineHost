import { headers } from "next/headers";
import { LanguageProvider } from "./language";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MineHost · Serververwaltung",
  description: "Dein Minecraft-Server auf dem Handy. Von überall verwalten.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders=await headers();const preference=requestHeaders.get("cookie")?.match(/(?:^|;\s*)minehost_language=(auto|de|en)(?:;|$)/)?.[1] as "auto"|"de"|"en"|undefined;const language=(requestHeaders.get("accept-language")||"en").toLowerCase().startsWith("de")?"de":"en";
  return (
    <html lang={preference&&preference!=="auto"?preference:language}>
      <body className="antialiased"><LanguageProvider initialLocale={language} initialChoice={preference||"auto"}>{children}</LanguageProvider></body>
    </html>
  );
}
