# EASY ARCADE Macro Studio

EASY ARCADE本体で使用するボタン出力、連射オーバーライド、tick単位のマクロ、ステートセレクタを編集するブラウザアプリです。物理ボタンから論理ボタンへの割り当ては本体側で設定し、連射は本体設定の継承・無効化・プロファイル上書きを選べます。1 tickあたりのフレーム数はプロファイル内の全マクロで共通です。

初期試作では、すべての処理がブラウザ内で完結します。設定はブラウザへ自動保存され、実機用の`.eamacro`ファイルとして書き出し・再読込できます。外部サーバーへ設定を送信しません。

## 起動

Node.js 22.13以降のLTS版を使用します（22系または24系以降）。

```bash
npm install
npm run dev
```

表示されたローカルURLをブラウザで開きます。

## 検証

```bash
npm run lint
npm test
```

## 主なファイル

- `app/MacroEditor.tsx`: エディタ画面と操作
- `app/profile.ts`: 編集モデル、検証、`.eamacro`コンパイラ／パーサー
- `docs/arcade_macro_profile_spec_v1.md`: 現在のファイル・実行仕様

## ファイル形式

- 拡張子: `.eamacro`
- Magic: `AMAP`
- Version: 1.0
- 最大サイズ: 8192 bytes
- Payload CRC: CRC-32/ISO-HDLC

`.eamacro`は本体用バイナリですが、Metadataセクションにプロファイル名や各定義の表示名を保持するため、エディタへ再読込して編集を続けられます。
