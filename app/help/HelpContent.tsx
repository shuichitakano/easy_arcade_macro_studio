"use client";

import Image from "next/image";
import Link from "next/link";
import { LanguageSwitch, useI18n } from "../i18n";

type Section = { title: string; paragraphs: string[] };
type Limit = { item: string; limit: string };
const PROFILE_SCHEMA_URL = "https://studio.easy-arcade.net/easy-arcade-profile.schema.json";

const content = {
  ja: {
    conceptsTitle: "用語と仕組み",
    conceptsLead: "EASY ARCADEの入力が、ゲーム基板へ届くまでの考え方を説明します。",
    flow: ["物理コントローラー", "論理ボタン", "ゲーム基板出力"],
    concepts: [
      { title: "物理入力・論理ボタン・基板出力", paragraphs: ["コントローラー上の物理ボタンは、まずEASY ARCADE本体の設定で論理ボタンへ変換されます。このエディタが扱うのは、その後の「論理ボタンからゲーム基板出力への変換」です。どの物理ボタンをAやBとして扱うかは、本体側で設定します。"] },
      { title: "論理ボタンと出力", paragraphs: ["通常の編集画面で扱う論理ボタンはCOIN、START、方向、A〜Jの16個です。ゲーム基板出力は1P側と2P側にそれぞれCOIN、START、方向、A〜Fの12個があります。G〜Jは直接対応する基板出力を持たず、マクロやステートセレクタの操作に使える4個の仮想ボタンです。ファイル形式には将来拡張用として32個までの論理ボタンIDが確保されています。", "1つの論理ボタンから複数の基板出力を同時に出せます。たとえば論理ボタンGを、1P側のA＋Bや2P側のAへ割り当てられます。複数の論理ボタンやマクロが同じ出力を生成した場合は、すべてOR合成されます。2P出力はプロファイル上部の2P設定を有効にした時だけ編集画面へ表示されます。"] },
      { title: "直接マッピングとマクロ", paragraphs: ["直接マッピングは、論理ボタンを押している間、割り当てた基板出力をそのまま出します。マクロは、ボタンをきっかけにtick単位の出力シーケンスを再生します。マクロを起動したボタンの直接マッピングも同時に有効です。", "プロファイル全体で「1 tickを何フレームにするか」を設定できます。たとえば2なら、すべてのマクロで1 tickを2フレーム出力してから次へ進みます。", "1つのマクロを複数の論理ボタンへ割り当てることも、1つの論理ボタンから複数のマクロを同時に起動することもできます。左右・上下反転や再生方法は、キー割り当てごとに設定されます。シーケンス要約では、DOWN＋LEFT＋A＋Bのような同時出力を↙＋A＋Bとまとめて確認できます。"] },
      { title: "マクロセット", paragraphs: ["マクロ定義とキー割り当ては別に保存されます。マクロセットを切り替えると、マクロ定義を作り直さずに、どの論理ボタンからどのマクロを起動するかをセットごとに変えられます。", "たとえば使用キャラクターごとに必要なマクロが異なるゲームでは、Set 0をキャラクターA用、Set 1をキャラクターB用として、同じ論理ボタンへ別のマクロを割り当てられます。同じマクロを複数セットから参照することもできます。直接マッピング、連射、ステートセレクタはセット間で共通です。"] },
      { title: "連射", paragraphs: ["連射設定は論理ボタンごとに、本体設定を使うか、プロファイルで上書きするかを選びます。上書き時は連射無効・同期・表・裏と、VSync周期を基準にした分周比を指定します。VSyncが60Hzの場合、分周比2は30連、3は20連です。"] },
      { title: "ステートセレクタ", paragraphs: ["ステートセレクタは、増加・減少ボタンで状態を切り替え、その状態に対応する基板出力を保持します。たとえばGEARというセレクタにLOW、MID、HIGHを作り、状態ごとに異なる出力を持たせられます。"] },
      { title: "プロファイル", paragraphs: ["これらの設定をまとめたものがプロファイルです。プロファイルを.eamacroファイルへエクスポートし、USBメモリなどを介して読み込ませることで、編集した設定をEASY ARCADE実機へ伝えられます。"] },
      { title: "Profile JSON", paragraphs: [".eamacro.jsonは、人間、AI、外部ツールと編集可能なプロファイルを交換するためのテキスト形式です。ボタンや出力をA、LEFTなどの名前で記述し、このエディタで読み込んで確認・修正してから実機用.eamacroへ書き出せます。Profile JSON自体に8KB制限はありませんが、実機用ファイルへ変換するときは本体向けの上限が適用されます。"] },
    ] as Section[],
    editorsTitle: "編集画面",
    editorsLead: "プロファイルを構成する設定を、目的別の画面で編集します。",
    editors: [
      { title: "ボタン設定", paragraphs: ["論理ボタンからゲーム基板出力への直接マッピングと、論理ボタンごとの連射設定を編集します。連射を上書きしないボタンには、EASY ARCADE本体の設定が使われます。"] },
      { title: "マクロ", paragraphs: ["マクロの出力シーケンス、起動する論理ボタン、再生方法、ループ位置、出力方向の反転を編集します。シーケンスはステップ形式とタイムライン形式のどちらからでも編集できます。"] },
      { title: "マクロセット", paragraphs: ["使用するマクロセットを追加し、それぞれに分かりやすい名前を付けます。セットごとのボタン割り当ては、マクロ編集画面で対象セットを選んで設定します。"] },
      { title: "ステートセレクタ", paragraphs: ["状態を増減する論理ボタン、状態数、初期状態、各状態で保持するゲーム基板出力を編集します。"] },
      { title: "割り当て一覧", paragraphs: ["論理ボタンごとの直接出力、連射、マクロ、ステートセレクタの割り当てをまとめて確認します。表示するマクロセットを切り替えて比較できます。"] },
      { title: "共有", paragraphs: ["現在のプロファイルを共有ライブラリへ公開したり、ほかのユーザーが公開したプロファイルをダウンロードまたはエディタへ読み込んだりできます。閲覧とダウンロードにはログインが不要です。", "投稿・編集・削除にはChatGPTでのログインが必要です。公開される作者情報は投稿時に入力した作者名だけで、ChatGPTの名前やメールアドレスは表示されません。"] },
    ] as Section[],
    limitsTitle: "仕様と制限",
    limitsLead: "実機用.eamacroファイルには、次の上限があります。Profile JSONはこのファイルサイズ制限を受けませんが、実機用ファイルへの書き出し時に検証されます。",
    limits: [
      { item: "論理ボタン", limit: "32 ID（通常の編集画面は16個：COIN、START、方向、A〜J）" },
      { item: "ゲーム基板出力", limit: "24（1P 12 ＋ 2P 12）" },
      { item: "マクロ", limit: "64" },
      { item: "マクロ割り当て", limit: "256" },
      { item: "マクロセット", limit: "16" },
      { item: "マクロの合計ステップ数", limit: "1024" },
      { item: "1マクロのステップ数", limit: "255" },
      { item: "1 tickあたりのフレーム数", limit: "1〜255" },
      { item: "1ステップの継続時間", limit: "1〜65535 tick" },
      { item: "ステートセレクタ", limit: "8" },
      { item: "1セレクタの状態数", limit: "64" },
      { item: ".eamacroファイルサイズ", limit: "8192 bytes" },
    ] as Limit[],
    limitsNote: "各項目の最大値をすべて同時に使えるとは限りません。最終的には.eamacroファイル全体が8192 bytes以内である必要があり、超過した場合は書き出せません。",
    schemaTitle: "Profile JSON Schema",
    schemaLead: "AIや外部ツールでProfile JSONを作成するときは、次のJSON Schemaを参照してください。",
    back: "エディタへ戻る",
    flowLabel: "入力変換の流れ",
  },
  en: {
    conceptsTitle: "Terms and Concepts",
    conceptsLead: "How EASY ARCADE turns controller input into signals for an arcade game board.",
    flow: ["Physical controller", "Logical button", "Game board output"],
    concepts: [
      { title: "Physical input, logical buttons, and outputs", paragraphs: ["Physical controller buttons are first mapped to logical buttons by the EASY ARCADE hardware. This editor handles the next stage: mapping logical buttons to game board outputs. Choose which physical button acts as A, B, and so on in the hardware settings."] },
      { title: "Logical buttons and outputs", paragraphs: ["The standard editor exposes 16 logical buttons: COIN, START, four directions, and A–J. Player 1 and Player 2 each have 12 game board outputs: COIN, START, four directions, and A–F. G–J have no direct board output and provide four virtual inputs for macros and state selectors. The file format reserves up to 32 logical-button IDs for future expansion.", "One logical button can activate several outputs at once. For example, logical button G can produce Player 1 A+B and Player 2 A. When several buttons or macros produce the same output, their signals are combined with OR logic. Player 2 outputs appear in the editors only when the 2P profile setting is enabled."] },
      { title: "Direct mapping and macros", paragraphs: ["A direct mapping holds its assigned outputs while the logical button is held. A macro starts an output sequence measured in ticks. The direct mapping of the trigger button remains active while its macro runs.", "The profile defines how many frames make up one tick. With a value of 2, every macro holds each tick for two frames before advancing.", "A macro can be assigned to several logical buttons, and one logical button can start several macros at once. Horizontal and vertical mirroring and playback behavior are configured per assignment. The sequence summary condenses simultaneous outputs such as DOWN+LEFT+A+B into ↙+A+B."] },
      { title: "Macro sets", paragraphs: ["Macro definitions and button assignments are stored separately. Switching macro sets changes which button starts which macro without duplicating the macro definitions.", "For example, Set 0 can contain assignments for Character A and Set 1 for Character B. The same logical button can start different macros in each set, and one macro can be referenced by several sets. Direct mappings, rapid fire, and state selectors are shared by all sets."] },
      { title: "Rapid fire", paragraphs: ["For each logical button, choose whether to inherit the hardware rapid-fire setting or override it in the profile. An override specifies Disabled, Sync, Front, or Back and a divisor based on the VSync period. At 60 Hz, divisor 2 produces 30 presses per second and divisor 3 produces 20."] },
      { title: "State selectors", paragraphs: ["A state selector changes state with increment and decrement buttons and holds the output assigned to that state. For example, a GEAR selector can have LOW, MID, and HIGH states with different outputs."] },
      { title: "Profiles", paragraphs: ["A profile contains all of these settings. Export it as an .eamacro file and transfer it through a USB drive or another storage device to load the edited settings into EASY ARCADE hardware."] },
      { title: "Profile JSON", paragraphs: ["The .eamacro.json text format exchanges editable profiles with people, AI, and external tools. Buttons and outputs use names such as A and LEFT. Open the JSON in this editor to review or edit it, then export an .eamacro file for the hardware. Profile JSON has no 8 KB limit of its own, but hardware limits apply when it is compiled."] },
    ] as Section[],
    editorsTitle: "Editor Screens",
    editorsLead: "Each screen edits a different part of the current profile.",
    editors: [
      { title: "Button Mapping", paragraphs: ["Edit direct mappings from logical buttons to game board outputs and rapid-fire settings for each logical button. Buttons without a rapid-fire override inherit the EASY ARCADE hardware setting."] },
      { title: "Macros", paragraphs: ["Edit output sequences, trigger buttons, playback behavior, loop positions, and output mirroring. Sequences can be edited as steps or on the timeline."] },
      { title: "Macro Sets", paragraphs: ["Add the macro sets you need and give each one a recognizable name. Choose a set in the macro editor to edit its button assignments."] },
      { title: "State Selectors", paragraphs: ["Edit the logical buttons that change state, the state range and initial value, and the game board output held by each state."] },
      { title: "Assignment Overview", paragraphs: ["Review direct outputs, rapid fire, macros, and state-selector controls for every logical button. Switch the displayed macro set to compare assignments."] },
      { title: "Sharing", paragraphs: ["Publish the current profile to the shared library, or download and open profiles published by other users. Browsing and downloading do not require sign-in.", "Publishing, editing, and deleting require Sign in with ChatGPT. The only public author information is the alias entered when publishing; your ChatGPT name and email address are not shown."] },
    ] as Section[],
    limitsTitle: "Specifications and Limits",
    limitsLead: "Hardware-ready .eamacro files are subject to the following limits. Profile JSON is not limited to 8 KB, but these limits are checked when exporting a hardware file.",
    limits: [
      { item: "Logical buttons", limit: "32 IDs (16 shown in the standard editor: COIN, START, directions, and A–J)" },
      { item: "Game board outputs", limit: "24 (12 for Player 1 + 12 for Player 2)" },
      { item: "Macros", limit: "64" },
      { item: "Macro assignments", limit: "256" },
      { item: "Macro sets", limit: "16" },
      { item: "Total macro steps", limit: "1,024" },
      { item: "Steps per macro", limit: "255" },
      { item: "Frames per tick", limit: "1–255" },
      { item: "Duration per step", limit: "1–65,535 ticks" },
      { item: "State selectors", limit: "8" },
      { item: "States per selector", limit: "64" },
      { item: ".eamacro file size", limit: "8,192 bytes" },
    ] as Limit[],
    limitsNote: "The maximum for every item cannot necessarily be used at the same time. The final .eamacro file must fit within 8,192 bytes; export is refused if it exceeds that size.",
    schemaTitle: "Profile JSON Schema",
    schemaLead: "Use this JSON Schema when creating Profile JSON with AI or external tools.",
    back: "Back to editor",
    flowLabel: "Input conversion flow",
  },
};

export function HelpContent() {
  const { locale } = useI18n();
  const page = content[locale];
  return <main className="help-shell">
    <header className="help-topbar"><div className="help-brand"><Image className="brand-icon" src="/favicon.svg" alt="" width={28} height={28} /><strong>EASY ARCADE Macro Studio</strong></div><div className="help-actions"><LanguageSwitch /><Link href="/">{page.back}</Link></div></header>
    <article className="help-content">
      <h1>{page.conceptsTitle}</h1><p className="help-lead">{page.conceptsLead}</p>
      {page.concepts.map((section, index) => <section className="help-section" key={section.title}><h2>{section.title}</h2>{index === 0 && <div className="concept-flow" aria-label={page.flowLabel}><span>{page.flow[0]}</span><b>→</b><span>{page.flow[1]}</span><b>→</b><span>{page.flow[2]}</span></div>}{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</section>)}
      <h1 className="help-subheading">{page.editorsTitle}</h1><p className="help-lead">{page.editorsLead}</p>
      {page.editors.map((section) => <section className="help-section" key={section.title}><h2>{section.title}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</section>)}
      <h1 className="help-subheading">{page.limitsTitle}</h1><p className="help-lead">{page.limitsLead}</p>
      <section className="help-section limits-reference"><div className="limits-table">{page.limits.map((entry) => <div className="limits-row" key={entry.item}><strong>{entry.item}</strong><span>{entry.limit}</span></div>)}</div><p>{page.limitsNote}</p></section>
      <section className="help-section schema-reference"><h2>{page.schemaTitle}</h2><p>{page.schemaLead}</p><a href={PROFILE_SCHEMA_URL}>{PROFILE_SCHEMA_URL}</a></section>
    </article>
  </main>;
}
