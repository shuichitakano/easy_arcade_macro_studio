# EASY ARCADE Macro Studio

EASY ARCADE本体で使用するボタン出力、連射オーバーライド、tick単位のマクロ、ステートセレクタを編集するブラウザアプリです。物理ボタンから論理ボタンへの割り当ては本体側で設定し、連射は本体設定の継承・無効化・プロファイル上書きを選べます。1 tickあたりのフレーム数はプロファイル内の全マクロで共通です。

編集処理はブラウザ内で完結します。設定はブラウザへ自動保存され、実機用の`.eamacro`と、人間・AI・外部ツールとの交換用`.eamacro.json`として書き出し・再読込できます。

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
- `app/profileJson.ts`: Profile JSONの検証、読み込み、正規化、書き出し
- `public/easy-arcade-profile.schema.json`: Profile JSON Schema
- `docs/arcade_macro_profile_spec_v1.md`: 現在のファイル・実行仕様

## ファイル形式

- 拡張子: `.eamacro`
- Magic: `AMAP`
- Version: 1.0
- 最大サイズ: 8192 bytes
- Payload CRC: CRC-32/ISO-HDLC

`.eamacro`は本体用バイナリです。MetadataもJSONではなく長さ付きUTF-8文字列のバイナリセクションで、プロファイル名や各定義の表示名を保持します。

`.eamacro.json`は編集・生成用のUTF-8 JSONです。ボタンと基板出力を名前で記述し、JSON自体には8KB制限を設けません。実機へ渡す際はエディタで検証し、`.eamacro`へ書き出します。
