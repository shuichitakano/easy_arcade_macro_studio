import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EASY ARCADE Macro Studio",
  description: "EASY ARCADE用.eamacroプロファイル編集ツール",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
