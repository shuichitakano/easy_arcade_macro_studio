import type { Metadata } from "next";
import "./globals.css";
import { I18nProvider } from "./i18n";

export const metadata: Metadata = {
  title: "EASY ARCADE Macro Studio",
  description: "Create and share .eamacro profiles for EASY ARCADE",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body><I18nProvider>{children}</I18nProvider></body>
    </html>
  );
}
