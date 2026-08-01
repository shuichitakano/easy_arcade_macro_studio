import type { Metadata } from "next";
import { MacroEditor } from "./MacroEditor";

export const metadata: Metadata = {
  title: "EASY ARCADE Macro Studio",
  description: "EASY ARCADEのボタン割り当てとマクロを編集するブラウザツール",
};

export default function Home() {
  return <MacroEditor />;
}
