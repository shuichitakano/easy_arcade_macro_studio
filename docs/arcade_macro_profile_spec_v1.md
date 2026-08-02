# EASY ARCADE Macro Profile 仕様書 v1.0

本書は、初期草案 `arcade_macro_profile_spec_v1.md` を実装判断に合わせて更新した正本である。

## 1. 目的と互換性

既存の物理入力割り当てと物理ボタン単位の連射を維持したまま、以下を追加する。

- 論理ボタンから実基板出力への直接マッピング
- 論理ボタンをトリガとするtick単位の固定シーケンス
- 最大16個のマクロセットと、セットごとのマクロ割り当て
- 増減入力によって持続出力を切り替えるステートセレクタ
- PCエディタと本体で交換する検証可能なバイナリプロファイル
- 人間、PCエディタ、AI、外部ツールで交換できる編集用Profile JSON

デフォルトプロファイルでは1P側のCOIN〜Fを同名出力へ1対1で割り当て、G〜Zは出力なし、2P出力は無効とする。マクロとセレクタを使わない場合は既存動作と一致しなければならない。

## 2. ファイル名と容量

- ユーザー向け拡張子: `.eamacro`
- ファイル内Magic: ASCII `AMAP`
- v1.0本体の最大受理サイズ: 8192 bytes
- 8192 bytesは交換形式の限界ではなく、初期実装の保存スロット上限である
- `Total Size`は32ビットのままとし、将来の本体は受理上限を拡張してよい

推奨MIME typeは `application/vnd.easy-arcade.macro` とする。

編集用Profile JSONの推奨ファイル名は `*.eamacro.json`、推奨MIME typeは `application/vnd.easy-arcade.macro+json` とする。

## 3. 入出力

ファイル形式は32個の論理ボタンIDを持つ。ID順にCOIN、START、UP、DOWN、LEFT、RIGHT、A〜Zとする。現行の標準エディタが表示・編集するのはID 0〜15（COIN、START、方向、A〜J）の16個で、G〜Jは対応する基板出力を持たない4個の仮想論理ボタンである。ID 16〜31（K〜Z）は将来拡張用に予約し、標準エディタでは表示しない。

実基板出力マスクは24ビットとする。bit 0〜11を1P側のCOIN、START、UP、DOWN、LEFT、RIGHT、A〜F、bit 12〜23を同じ順序の2P側出力とする。プロファイルの`Two Player Outputs`が無効な場合、bit 12〜23は0でなければならない。

2P出力は論理入力を増やす機能ではない。論理ボタンIDは常に32個のままであり、1つの論理ボタン、マクロステップ、セレクタ状態から1P側と2P側へ同時出力できる。

物理コントローラー入力から論理ボタンへの割り当てはEASY ARCADE本体の既存設定であり、ゲームプロファイルには含めない。PCエディタが扱うのは、物理機器に依存しない「論理ボタンからゲーム内機能へのルーティング」である。

### 3.1 連射の位置づけ

既存の連射は物理ボタン単位の本体設定である。論理ボタンごとに`Override`フラグを持ち、未チェックなら本体設定をそのまま使用する。チェック時だけ、ゲームプロファイルのトリガタイプと速度で上書きする。

- `Override=0`: 各物理入力の本体連射設定を適用した後、論理ボタン単位でORした状態を直接マッピングに使用する
- `Override=1`: 本体連射設定を無視し、プロファイルのTrigger TypeとRate Divisorを適用する
- Trigger Typeは`連射無効`、`同期`、`表`、`裏`の4種とし、意味と位相は本体の既存Rapid-Fire Processorと同一にする
- `連射無効`は生論理状態をそのまま直接マッピングに使用する。これは「本体設定を連射なしで上書き」の意味である
- Rate Divisor=Nはゲーム基板のVSync周期に対する`1/N`を表す。VSyncが60Hzの場合、1/2=30Hz、1/3=20Hz、1/4=15Hz、1/5=12Hz、1/6=10Hzとなる
- マクロ起動、マクロ停止、セレクタ増減は連射前の生論理状態を使用する
- したがって、既存連射のパルスでマクロやセレクタが繰り返し起動することはない

## 4. フレーム処理

1. 物理入力をサンプリングする
2. 生論理状態、既存連射後論理状態、プロファイル連射後論理状態を生成する
3. 生論理状態の立ち上がり・立ち下がりエッジを生成する
4. 即時中断対象のシーケンスを停止する
5. ステートセレクタを更新する
6. 現在のマクロセットで有効な新規シーケンスを開始する
7. プロファイル連射後論理状態から直接出力を生成する
8. 実行中シーケンスの現在出力へ、バインディングごとの反転変換を適用する
9. 直接出力、全シーケンス出力、ニュートラル期間外の全セレクタ出力をORする
10. SOCD処理と最終補正を適用して基板へ反映する
11. シーケンスのフレーム位相と残りtick、およびニュートラル期間の残りフレームを更新する

シーケンスの起動・停止とセレクタ操作には連射前の生論理状態を使う。直接マッピングだけが連射後論理状態を使う。シーケンス出力を論理入力へ戻してはならない。

## 5. 直接マッピング

各論理ボタンは0個以上の実基板出力へ割り当てられる。複数の論理ボタンおよびシーケンスが同じ出力を生成した場合はOR合成する。シーケンス起動に使った論理ボタンの直接マッピングも同時に評価される。

## 6. シーケンサ

プロファイルは共通の`Frame Step`を持ち、1 tickを何フレーム継続するかを1〜255で指定する。`Frame Step=2`なら、すべてのシーケンスのtickは2フレームごとに1つ進む。各ステップは絶対出力マスクと継続tick数を持ち、継続tick数は1〜65535とする。

押下フレームからステップ0を出力する。`Frame Step=N`、継続tick数1のステップは、押下フレームを含むNフレームに同じ出力を保持し、その次のフレームで次のtickへ進む。リリースによる即時中断の判定はtick境界に限らず毎フレーム行う。`Frame Step`はゲームのVSync周期に合わせるプロファイル全体の設定であり、すべてのシーケンスで共通とする。

各論理ボタンは0個以上のシーケンスへバインドできる。同一シーケンスを複数ボタンから参照してよい。再生状態はバインディングごとに独立し、実行中の同一バインディングへの再トリガは無視する。開始を遅らせる場合は、シーケンス先頭に出力マスク0のステップを置く。

マクロ定義とキー割り当ては別テーブルとする。各バインディングは1-byteの`Set ID`を持ち、現在のSet IDと一致するバインディングだけを起動する。同じマクロと論理ボタンの組を複数セットで有効にする場合は、Set IDごとに独立したバインディングを置く。したがって再生属性と出力変換もセットごとに設定できる。

各バインディングは出力変換として「なし」「左右反転」「上下反転」「上下左右反転」のいずれかを持つ。左右反転はLEFTとRIGHT、上下反転はUPとDOWNの出力ビットを各ステップの出力時に交換し、その他の出力ビットは変更しない。2P出力が有効な場合、この交換を1P側と2P側へそれぞれ独立に適用する。変換はシーケンス定義を書き換えず、再生インスタンスごとに適用する。同じシーケンスを複数入力へ異なる変換で割り当ててよい。

再生属性は次の組み合わせとする。

- 単発 / ボタン保持中反復
- リリース後に現在周回を完了 / リリースフレームから即時中断

保持中反復では、初回をステップ0から、2周目以降を`Loop Start Step`から再生する。

## 7. マクロセット

プロファイルは1〜16個のマクロセットを持つ。Set IDは0から連続し、マクロエンジンへ渡される現在のSet IDは1つだけとする。

現在のSet IDを選択・切替・保持する方法はEASY ARCADE本体側の機能であり、このプロファイル形式では規定しない。直接マッピング、連射設定、ステートセレクタはマクロセットに関係なく共通とする。セット名はUTF-8 Metadataに保存し、対応機種は現在のセット名を表示できる。

### 7.1 ステートセレクタ

セレクタはID、名前、増加論理ボタン、減少論理ボタン、最小値、最大値、初期値、Clamp/Wrap、ニュートラルフレーム数、状態別の名前と出力を持つ。

増減は生論理状態の立ち上がりで1回だけ行う。同一フレームに増加と減少があった場合は変更しない。ニュートラル期間中の追加操作は状態を即時更新し、残り期間を設定値へ戻す。

各状態出力は24ビットの実基板出力マスクである。ニュートラル期間中はそのセレクタの出力を0とする。複数セレクタ、直接マッピング、マクロが同じ出力を生成した場合はOR合成する。セレクタは他の出力源を占有または消去しない。

## 8. v1.0実装上限

| 項目 | 上限 |
|---|---:|
| 論理ボタンID数 | 32（標準エディタ表示は16） |
| 実基板出力数 | 24（1P 12 + 2P 12） |
| シーケンス定義数 | 64 |
| シーケンスバインディング数 | 256 |
| マクロセット数 | 16 |
| 全シーケンス合計ステップ数 | 1024 |
| 1シーケンスの最大ステップ数 | 255 |
| Frame Step（1 tickあたりのフレーム数） | 1〜255 |
| 1ステップの最大継続tick数 | 65535 |
| ステートセレクタ数 | 8 |
| 1セレクタの最大状態数 | 64 |
| `.eamacro`全体サイズ | 8192 bytes |

すべて集中定義された実装定数とする。個別の件数上限は、全項目を同時に最大まで格納できることを保証しない。最終的な受理条件として、ファイル全体が8192 bytes以下でなければならない。

## 9. EASY ARCADE Profile JSON

EASY ARCADE Profile JSONは、プロファイルを編集・生成・交換するための標準テキスト形式である。AI専用形式ではなく、人間による手書き、PCエディタ、外部ツール、REST API、MCPなど、生成元を問わず同じ形式を使用する。「AI Recipe JSON」のような別形式は設けない。

Profile JSONはUTF-8で保存する。推奨拡張子は`.eamacro.json`とする。EASY ARCADE本体が直接読み込む形式は引き続き`.eamacro`であり、Profile JSONはPCエディタまたは互換ツールで検証後、決定的に`.eamacro`へコンパイルする。

Profile JSON自体に8192 bytesの上限は設けない。ただし、v1.0本体向けにコンパイルした`.eamacro`は第8章の件数上限および8192 bytesの全体上限を満たさなければならない。コンパイル結果が上限を超える場合は、変換せず明確なエラーを返す。

### 9.1 基本構造

トップレベルはJSON objectとし、次のフィールドを持つ。

| Field | 必須 | 内容 |
|---|---|---|
| `format` | 必須 | 固定文字列`easy-arcade-profile` |
| `schemaVersion` | 必須 | Profile JSON Schemaの整数バージョン。初期値は1 |
| `name` | 必須 | プロファイル名 |
| `description` | 必須 | 説明。空文字列可 |
| `frameStep` | 必須 | 第6章の共通Frame Step |
| `twoPlayerOutputs` | 任意 | 2P側出力を使用する場合は`true`。省略時は`false` |
| `mappings` | 必須 | 論理ボタンから実基板出力への直接マッピング |
| `rapidFire` | 必須 | 論理ボタンごとの連射設定 |
| `macroSets` | 必須 | マクロセット定義 |
| `sequences` | 必須 | シーケンス定義 |
| `bindings` | 必須 | セットごとのシーケンス割り当て |
| `selectors` | 必須 | ステートセレクタ定義 |
| `metadata` | 任意 | 生成元、参照資料、検証状態など、実行に影響しない付加情報 |

`schemaVersion`はProfile JSONの構造バージョンであり、`.eamacro`ヘッダのMajor/Minorとは独立する。本節の追加によって`.eamacro`のファイル形式バージョンは1.0から変更しない。

### 9.2 名前による入出力表現

Profile JSONでは、論理ボタンと実基板出力をビット番号や数値マスクではなく、第3章で定義した名前で記述する。

- 論理ボタン名: `COIN`、`START`、`UP`、`DOWN`、`LEFT`、`RIGHT`、`A`〜`Z`
- 1P実基板出力名: `COIN`、`START`、`UP`、`DOWN`、`LEFT`、`RIGHT`、`A`〜`F`
- 2P実基板出力名: `2P_COIN`、`2P_START`、`2P_UP`、`2P_DOWN`、`2P_LEFT`、`2P_RIGHT`、`2P_A`〜`2P_F`
- 複数出力: 出力名のJSON array。出力なしは空array

`mappings`と`rapidFire`は論理ボタン名をキーとするobjectとする。標準エディタで表示する16個は必須とし、予約済みのK〜Zは省略可能とする。省略した予約IDは、直接出力なし・連射上書きなしとして扱う。正規化して保存する際は32個すべてを第3章のID順に並べる。

シーケンスの各ステップは`outputs`と`ticks`を持つ。`outputs`は実基板出力名のarray、`ticks`は1〜65535の整数とする。JSON上でも継続時間の単位はフレームではなくtickであり、実フレーム長は`ticks × frameStep`である。

### 9.3 マクロと割り当て

`macroSets`の各要素は`id`と`name`を持つ。IDは0から連続し、要素順と一致しなければならない。

`sequences`の各要素は`id`、`name`、`loopStart`、`steps`を持つ。`bindings`の各要素は`logicalButton`、`sequenceId`、`setId`、`loop`、`cancelOnRelease`、`transform`を持つ。`transform`は`none`、`flipHorizontal`、`flipVertical`、`flipBoth`のいずれかとする。

シーケンス定義と割り当てはProfile JSONでも別テーブルとする。同じシーケンスを複数の論理ボタンや複数のマクロセットから参照でき、再生属性と出力変換は割り当てごとに保持する。

### 9.4 ステートセレクタ

`selectors`の各要素は`id`、`name`、`incrementButton`、`decrementButton`、`minimum`、`maximum`、`initial`、`wrap`、`neutralFrames`、`states`を持つ。`states`は状態値の昇順で並べ、各要素は`value`、`name`、`outputs`を持つ。`outputs`は実基板出力名のarrayとする。

### 9.5 任意Metadata

`metadata`は実行動作に影響してはならない。生成元を記録する場合は、形式名へ`AI`を付けず、たとえば次の任意フィールドを使用できる。

| Field | 内容 |
|---|---|
| `generator` | 生成したアプリケーション、サービス、モデルなどの名称 |
| `sources` | 参照したURLの文字列array |
| `verification` | `unverified`、`editor-validated`、`emulator-tested`、`hardware-tested`のいずれか |

未知のMetadataフィールドは無視してよい。生成元や検証状態を記録しないProfile JSONも有効である。

Profile JSONの`metadata`は編集・生成・共有のための情報であり、`.eamacro`へは格納しない。実機表示に必要な名前と説明だけを、第10章のコンパクトMetadataへ変換する。

### 9.6 最小例

次は構造を示すために、`mappings`と`rapidFire`のうち一部を省略した説明用の断片である。実際のファイルでは標準エディタ表示分の16個を記述する。

```json
{
  "format": "easy-arcade-profile",
  "schemaVersion": 1,
  "name": "Hadoken Sample",
  "description": "右向きの波動拳入力",
  "frameStep": 1,
  "mappings": {
    "A": ["A"],
    "G": []
  },
  "rapidFire": {
    "A": { "override": false, "triggerType": "disabled", "divisor": 2 },
    "G": { "override": false, "triggerType": "disabled", "divisor": 2 }
  },
  "macroSets": [
    { "id": 0, "name": "Ryu" }
  ],
  "sequences": [
    {
      "id": 0,
      "name": "Hadoken",
      "loopStart": 0,
      "steps": [
        { "outputs": ["DOWN"], "ticks": 1 },
        { "outputs": ["DOWN", "RIGHT"], "ticks": 1 },
        { "outputs": ["RIGHT", "A"], "ticks": 1 }
      ]
    }
  ],
  "bindings": [
    {
      "logicalButton": "G",
      "sequenceId": 0,
      "setId": 0,
      "loop": false,
      "cancelOnRelease": false,
      "transform": "none"
    }
  ],
  "selectors": [],
  "metadata": {
    "generator": "example tool",
    "verification": "unverified",
    "sources": []
  }
}
```

### 9.7 検証と正規化

Profile JSONにはJSON Schemaを提供する。読み込み時はJSON Schemaによる型・必須項目・列挙値の検証に加え、第8章の件数上限、ID重複、参照関係、出力範囲、ループ位置など、`.eamacro`生成時と同等の意味検証を行う。

不明なトップレベルフィールドおよび実行に関係する不明フィールドは、入力ミスを検出するためエラーとする。`metadata`内の不明フィールドだけは許可する。

正規化時は論理ボタン、出力、マクロセット、シーケンス、バインディング、セレクタを仕様上のID順へ並べ、同じProfile JSONから常に同一の`.eamacro`バイト列を生成する。Profile JSONから`.eamacro`へ変換した後、再度Profile JSONへ変換した場合、実行に影響しないMetadataを除いて同じ設定を復元できなければならない。

## 10. バイナリ形式

全整数はリトルエンディアン。ファイルヘッダは16 bytes固定であり、「4 bytesのファイルヘッダ」という旧記述は誤りとして廃止する。

| Offset | Size | Field | Value |
|---:|---:|---|---|
| 0 | 4 | Magic | `AMAP` |
| 4 | 1 | Major | 1 |
| 5 | 1 | Minor | 0 |
| 6 | 2 | Header Size | 16 |
| 8 | 4 | Total Size | ヘッダを含む全体長 |
| 12 | 4 | Payload CRC32 | offset 16から末尾まで |

CRCはCRC-32/ISO-HDLC（poly `0x04C11DB7`、refin/refout true、init/xorout `0xFFFFFFFF`、check `123456789`=`0xCBF43926`）とする。

ヘッダ後はTLVセクションを連続配置する。各TLVヘッダはType 1 byte、Flags 1 byte、Payload Length 2 bytes。Flagsは0固定。未知TypeはLengthに従ってスキップする。既知セクションの余剰バイトは許可しない。

バイト列はアラインメントを保証しない。本体はバイナリをC構造体へ直接キャストせず、明示的なlittle-endian読み取りを行う。

| Type | Section | 必須 |
|---:|---|---|
| `0x01` | Direct Mapping | 必須・1個 |
| `0x02` | Sequence Binding | 必須・1個 |
| `0x03` | Sequence Definitions | 任意・最大1個 |
| `0x04` | State Selectors | 任意・最大1個 |
| `0x05` | Rapid Fire Overrides | 必須・1個 |
| `0x06` | Macro Sets | 必須・1個 |
| `0x07` | Profile Settings | 必須・1個 |
| `0x08` | Compact UTF-8 Metadata | 任意・最大1個 |

### Direct Mapping

ID順の32個のuint24出力マスク。各uint24は下位byteから格納し、Payloadは96 bytes固定。標準エディタで未使用のID 16〜31は0とする。

### Sequence Binding

先頭uint16がバインディング数。続く各4-byteレコードはLogical ID、Sequence ID、Set ID、Playback Flags。Playback Flagsのbit 0は保持中反復、bit 1はリリース時即時中断、bit 2は左右反転、bit 3は上下反転、bit 4〜7は0。同じLogical IDを複数レコードに含めてよい。同じSet ID、Logical ID、Sequence IDの組は重複してはならない。

### Sequence Definitions

先頭1 byteが定義数。各定義はSequence ID、Step Count、Loop Start Step、Reservedの4 bytesで、Reservedは0。続く各ステップはuint24 Output Maskとuint16 Duration Ticksの5 bytes。

### State Selectors

先頭1 byteが定義数。各定義ヘッダは10 bytesで、Selector ID、Increment Logical ID、Decrement Logical ID、Minimum、Maximum、Initial、Flags、Neutral Gap Frames、State Count、Reserved。Flags bit 0はWrap、その他は0。続けてState Count個のuint24出力マスクを置く。

### Rapid Fire Overrides

論理ボタンID順に32個の3-byteレコードを格納し、Payloadは96 bytes固定とする。標準エディタで未使用のID 16〜31はOverride=0とする。

| Byte | Field | 内容 |
|---:|---|---|
| 0 | Override Flags | bit 0: 1ならプロファイルで上書き、bit 1〜7は0 |
| 1 | Trigger Type | 0: 連射無効、1: 同期、2: 表、3: 裏 |
| 2 | Rate Divisor | 2〜60。ゲーム基板のVSync周期に対する分母 |

Overrideが0の場合、Trigger TypeとRate Divisorは本体動作に影響しないが、エディタで再度有効化した際の値を保持するためファイルには保存してよい。

### Macro Sets

Payloadは2 bytes固定とする。

| Byte | Field | 内容 |
|---:|---|---|
| 0 | Set Count | 1〜16 |
| 1 | Reserved | 0 |

### Profile Settings

Payloadは2 bytes固定とする。

| Byte | Field | 内容 |
|---:|---|---|
| 0 | Frame Step | プロファイル共通の1 tickあたりのフレーム数。1〜255 |
| 1 | Flags | bit 0: Two Player Outputs、bit 1〜7: 0 |

Two Player Outputsが0の場合、すべての出力マスクのbit 12〜23は0でなければならない。

初期試作版との読み込み互換のため、Profile SettingsがないファイルではFrame Stepを1として扱ってよい。また、Sequence DefinitionsのReservedに旧マクロ単位のFrame Stepが残るファイルは、最初の有効値をプロファイル共通値へ移行してよい。新規保存時はProfile Settingsへ格納し、Sequence DefinitionsのReservedは0とする。

### Metadata

MetadataはJSONではなく、長さ付きUTF-8文字列を連続配置するコンパクトなバイナリ形式とする。本体へJSONパーサを要求してはならない。

Payload先頭の固定ヘッダは10 bytesとする。

| Offset | Size | Field | 内容 |
|---:|---:|---|---|
| 0 | 1 | Metadata Version | 1 |
| 1 | 1 | Flags | 0 |
| 2 | 2 | Profile Name Length | UTF-8 byte数 |
| 4 | 2 | Description Length | UTF-8 byte数 |
| 6 | 1 | Sequence Name Count | Sequence Definitionsの定義数と一致 |
| 7 | 1 | Macro Set Name Count | Macro SetsのSet Countと一致 |
| 8 | 1 | Selector Name Count | State Selectorsの定義数と一致 |
| 9 | 1 | Reserved | 0 |

固定ヘッダの直後に、Profile NameとDescriptionのUTF-8 byte列をこの順で置く。終端NULは付けない。

続けてSequence Name Count個のシーケンス名レコードをSequence ID昇順で置く。

| Size | Field |
|---:|---|
| 1 | Sequence ID |
| 2 | Name Length |
| 可変 | Name UTF-8 bytes |

続けてMacro Set Name Count個のマクロセット名レコードをSet ID順で置く。Set IDは要素順から決まるため格納しない。

| Size | Field |
|---:|---|
| 2 | Name Length |
| 可変 | Name UTF-8 bytes |

続けてSelector Name Count個のセレクタ名レコードをSelector ID昇順で置く。

| Size | Field |
|---:|---|
| 1 | Selector ID |
| 2 | Selector Name Length |
| 1 | State Name Count |
| 可変 | Selector Name UTF-8 bytes |
| 可変 | State Name Records |

各State Name Recordはuint16 Name LengthとUTF-8 byte列で構成し、State Selectorsセクション内の状態出力と同じ順序で並べる。State Name Countは対応するセレクタのState Countと一致しなければならない。

すべてのuint16はリトルエンディアンとする。既知レコードの不足、余剰byte、ID重複、未定義ID、件数不一致、不正UTF-8を拒否する。名称は単一のUTF-8文字列とし、実機表示用の別名は設けない。表示能力に制限がある機種はMetadataセクション全体を無視してよい。たとえばセレクタ名が`GEAR`、現在ステート名が`LOW`なら、対応機種は`GEAR: LOW`のように表示できる。

Metadataも8192 bytesの全体上限に含む。Profile JSONの`metadata`にある生成元、参照URL、検証状態などは`.eamacro`へ格納しない。

## 11. 本体ランタイム

検証済みの`.eamacro`バイト列をFlashまたはRAMに保持し、次だけをランタイムへ展開する。

- 整列済みDirect Mapping配列
- Sequence IDから定義オフセットへの索引
- セレクタ定義オフセットへの索引
- プロファイル共通の`Frame Step`
- 各シーケンスバインディングの再生状態（現在ステップ、残りtick、フレーム位相）
- 現在のマクロセット
- 各論理ボタンのプロファイル連射位相
- 各セレクタの現在状態、現在出力、ニュートラル残り時間

シーケンスはステップ遷移時に次ステップを読み、現在出力、残りtick、`Frame Step`内のフレーム位相をキャッシュする。毎フレームTLVを探索しない。

## 12. 読み込みと原子的適用

全データ受信、ヘッダ、サイズ、CRC、全セクション、予約領域、参照関係、実装上限、マスク競合を検証してから現在設定と交換する。失敗時は現在設定と実行状態を変更しない。成功時は全シーケンスを停止し、全セレクタを初期値に戻し、次フレームから適用する。

RP2040系のFlash保存では8KBを1スロットとし、別の空きスロットへ書き込み、CRC検証後に管理レコードを切り替える方式を推奨する。

## 13. PCエディタ

エディタ内部はJSON相当の編集モデルを使用する。実機との交換には`.eamacro`、人間、AI、外部ツールとの編集データ交換には`.eamacro.json`を使用する。ブラウザ内ではIndexedDBに複数の作業プロファイルを保持し、切替、新規作成、複製、初期化、削除、自動保存に対応する。旧ローカルストレージの単一プロファイルが存在する場合は初回に移行してよい。

UIはバイナリのセクション配置をそのまま見せず、次の責務に分ける。

1. **ボタン設定**: 論理ボタンごとの直接出力と連射オーバーライドを編集する
2. **マクロシーケンス**: 編集対象のマクロセットを切り替え、名前、セットごとの複数トリガーボタン、入力ごとの出力反転、再生属性、ステップ列、ループ開始位置を編集する。任意位置へのステップ挿入・削除と、入力割り当てを含むマクロ全体の複製に対応する
3. **マクロセット**: 1〜16個のセット名を編集する。初期セットと切替操作はプロファイル設定に含めない
4. **ステートセレクタ**: 増加・減少論理ボタン、状態範囲、Clamp/Wrap、ニュートラル期間、状態出力を編集する
5. **割り当て一覧**: 表示対象のマクロセットを切り替え、論理ボタンごとの直接出力、連射、そのセットで有効なマクロ、全ステートモディファイアを横断表示する。読み取り専用でよい

`Frame Step`は全マクロ共通の設定として、マクロ画面のセット切替行に置く。個別のマクロ編集項目や、連射へ影響する共通設定にはしない。

連射速度は2〜60のRate Divisorを数値入力し、割り当て一覧では`1/2 (30連)`のように60Hz基準の参考連射数を併記する。

`.eamacro`および`.eamacro.json`の読み込みは、検証後にブラウザ内の新しい作業プロファイルとして追加する。`.eamacro.json`の読み込みエラーでは、可能な限り該当フィールドと理由を示す。

標準の実機向け書き出しは`.eamacro`とする。Profile JSONの書き出しも提供し、対応ブラウザではOSの保存ダイアログを開いて、ユーザーが任意の保存先とファイル名を選択できるようにする。非対応ブラウザでは通常のファイルダウンロードへフォールバックする。

同じシーケンス定義は複数の論理ボタンへ割り当ててよく、同じ論理ボタンから複数のシーケンスを起動してよい。反復、リリース属性、出力反転は各バインディングに属する。遅延違いの派生マクロは複製し、先頭に任意長の無出力ステップを追加して表現できる。

マクロ起動入力と左右・上下反転フラグは、論理ボタンごとの同一UI要素内で編集する。反転属性だけを別一覧へ分離しない。

マクロ編集にはステップ表示に加え、横軸をtick、縦軸を実基板出力とするピアノロール形式の「タイムライン」表示を設ける。1Pモードでは12行、2Pモードでは1P・2Pを合わせた24行を表示する。1マスは1 tickとし、セル操作でそのtickの出力ビットをON/OFFできる。tickの前後挿入、削除、末尾追加に対応する。実フレーム長は`総tick数 × Frame Step`として併記する。64 tickを超えるシーケンスは64 tick単位で表示ページを分割し、その場合だけページ切替UIを表示する。ページは編集上の表示区切りであり、再生動作には影響しない。タイムライン編集後は、連続する同一出力マスクをステップへ再圧縮する。

ステップ列全体を素早く読めるように、編集形式とは別にコンパクトなシーケンス要約を常時表示する。同一ステップ内の上下・左右入力は方向記号へまとめ、たとえばDOWN+LEFT+A+Bを`↙+A+B`、LEFT+RIGHTを`←+→`と表示する。継続tick数が2以上なら`×N`を付け、2P出力を含む場合は1P/2Pを区別する。

生成順は`0x01`、`0x02`、`0x03`、`0x04`、`0x05`、`0x06`、`0x07`、`0x08`とし、バインディングはLogical ID・Sequence ID順、シーケンスとセレクタはID順に出力する。同じ編集内容は同一バイト列にする。生成前に本体と同等の検証を行う。

初期試作エディタが生成したType `0x7F`のJSON Metadataは正式なv1.0形式に含めない。PCエディタは既存の共有データを移行するために限り読み込んでよいが、新規保存してはならない。EASY ARCADE本体はType `0x7F`へ対応する必要がない。

同様に、初期試作エディタが生成したuint16出力マスクのDirect Mapping、Sequence Definitions、State SelectorsはPCエディタが移行読み込みしてよい。新規保存は常に本章のuint24形式とし、EASY ARCADE本体はuint16試作形式へ対応する必要がない。

初期試作エディタが生成した17個または18個の論理ボタンを持つDirect MappingおよびRapid Fire Overridesも、PCエディタは移行読み込みしてよい。存在しない論理ボタンIDは既定値で補い、新規保存は常に32個のレコードを出力する。EASY ARCADE本体はこれらの試作形式へ対応する必要がない。

オンライン共有では、サーバー内部の保存形式としてProfile JSONまたは同等の正規化済みデータを使用できる。共有サイトからダウンロードする実機向け成果物は、検証済みProfile JSONからサーバーまたはエディタが生成した`.eamacro`とする。REST APIやMCPを追加する場合も、独自のAI専用形式を設けず、Profile JSONを共通の入出力形式とする。

## 14. 受入条件

- デフォルトプロファイルが従来動作と一致する
- 連射パルスがシーケンスを再トリガしない
- 未上書き、連射無効、同期、表、裏と各Rate Divisorが仕様どおり動作する
- 1つの論理ボタンから複数マクロが起動し、先頭の無出力ステップによる開始タイミングが正確である
- プロファイル共通の`Frame Step=1`および2以上で、全マクロのtick遷移と総フレーム長が設定どおりである
- シーケンスの全再生モード、ループ位置、同時実行、終了が決定的である
- 同一シーケンスを入力ごとに無変換、左右反転、上下反転、上下左右反転で再生できる
- 同じマクロと論理ボタンの組をSet 0とSet 3などへ独立して割り当てられる
- セレクタのClamp、Wrap、同時増減、ニュートラル、OR合成が仕様どおりである
- 8KB超過、CRC不一致、不正参照、予約ビット、マスク競合を拒否する
- 不正ファイル拒否後も現在プロファイルを維持する
- `.eamacro`をエディタで保存し、再読込して同じ設定を復元できる
- `.eamacro.json`をエディタで保存し、再読込して同じ設定を復元できる
- Profile JSONの不正な型、未知フィールド、不正参照、定義件数上限超過を、`.eamacro`を生成せず拒否できる
- 8192 bytesを超えるProfile JSONも読み込んで編集でき、コンパイル結果が8192 bytesを超える場合だけ`.eamacro`書き出しを拒否できる
- 同じProfile JSONから常に同一の`.eamacro`バイト列を生成できる
