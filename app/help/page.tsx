import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "ヘルプ | EASY ARCADE Macro Studio",
};

export default function HelpPage() {
  return (
    <main className="help-shell">
      <header className="help-topbar"><div className="help-brand"><Image className="brand-icon" src="/favicon.svg" alt="" width={28} height={28} /><strong>EASY ARCADE Macro Studio</strong></div><Link href="/">エディタへ戻る</Link></header>
      <article className="help-content">
        <h1>用語と仕組み</h1>
        <p className="help-lead">EASY ARCADEの入力が、ゲーム基板へ届くまでの考え方を説明します。</p>

        <section className="help-section">
          <h2>物理入力・論理ボタン・基板出力</h2>
          <div className="concept-flow" aria-label="入力変換の流れ"><span>物理コントローラー</span><b>→</b><span>論理ボタン</span><b>→</b><span>ゲーム基板出力</span></div>
          <p>コントローラー上の物理ボタンは、まずEASY ARCADE本体の設定で論理ボタンへ変換されます。このエディタが扱うのは、その後の「論理ボタンからゲーム基板出力への変換」です。どの物理ボタンをAやBとして扱うかは、本体側で設定します。</p>
        </section>

        <section className="help-section">
          <h2>論理ボタンと出力</h2>
          <p>論理ボタンはCOIN、START、方向、A〜Lの18個です。ゲーム基板出力はCOIN、START、方向、A〜Fの12個です。G〜Lは直接対応する基板出力を持たず、マクロやステートセレクタの操作に使える仮想ボタンです。</p>
          <p>1つの論理ボタンから複数の基板出力を同時に出せます。たとえば論理ボタンGを、基板出力のA＋Bへ割り当てられます。複数の論理ボタンやマクロが同じ出力を生成した場合は、すべてOR合成されます。</p>
        </section>

        <section className="help-section">
          <h2>直接マッピングとマクロ</h2>
          <p>直接マッピングは、論理ボタンを押している間、割り当てた基板出力をそのまま出します。マクロは、ボタンをきっかけにtick単位の出力シーケンスを再生します。マクロを起動したボタンの直接マッピングも同時に有効です。</p>
          <p>プロファイル全体で「1 tickを何フレームにするか」を設定できます。たとえば2なら、すべてのマクロで1 tickを2フレーム出力してから次へ進みます。</p>
          <p>1つのマクロを複数の論理ボタンへ割り当てることも、1つの論理ボタンから複数のマクロを同時に起動することもできます。左右・上下反転や再生方法は、キー割り当てごとに設定されます。</p>
        </section>

        <section className="help-section">
          <h2>マクロセット</h2>
          <p>マクロ定義とキー割り当ては別に保存されます。マクロセットを切り替えると、マクロ定義を作り直さずに、どの論理ボタンからどのマクロを起動するかをセットごとに変えられます。</p>
          <p>たとえば使用キャラクターごとに必要なマクロが異なるゲームでは、Set 0をキャラクターA用、Set 1をキャラクターB用として、同じ論理ボタンへ別のマクロを割り当てられます。同じマクロを複数セットから参照することもできます。直接マッピング、連射、ステートセレクタはセット間で共通です。</p>
        </section>

        <section className="help-section">
          <h2>連射</h2>
          <p>連射設定は論理ボタンごとに、本体設定を使うか、プロファイルで上書きするかを選びます。上書き時は連射無効・同期・表・裏と、VSync周期を基準にした分周比を指定します。VSyncが60Hzの場合、分周比2は30連、3は20連です。</p>
        </section>

        <section className="help-section">
          <h2>ステートセレクタ</h2>
          <p>ステートセレクタは、増加・減少ボタンで状態を切り替え、その状態に対応する基板出力を保持します。たとえばGEARというセレクタにLOW、MID、HIGHを作り、状態ごとに異なる出力を持たせられます。</p>
        </section>

        <section className="help-section">
          <h2>プロファイル</h2>
          <p>これらの設定をまとめたものがプロファイルです。プロファイルを<code>.eamacro</code>ファイルへエクスポートし、USBメモリなどを介して読み込ませることで、編集した設定をEASY ARCADE実機へ伝えられます。</p>
        </section>

        <h1 className="help-subheading">編集画面</h1>
        <p className="help-lead">プロファイルを構成する設定を、目的別の画面で編集します。</p>

        <section className="help-section">
          <h2>ボタン設定</h2>
          <p>論理ボタンからゲーム基板出力への直接マッピングと、論理ボタンごとの連射設定を編集します。連射を上書きしないボタンには、EASY ARCADE本体の設定が使われます。</p>
        </section>

        <section className="help-section">
          <h2>マクロ</h2>
          <p>マクロの出力シーケンス、起動する論理ボタン、再生方法、ループ位置、出力方向の反転を編集します。シーケンスはステップ形式とタイムライン形式のどちらからでも編集できます。</p>
        </section>

        <section className="help-section">
          <h2>マクロセット</h2>
          <p>使用するマクロセットを追加し、それぞれに分かりやすい名前を付けます。セットごとのボタン割り当ては、マクロ編集画面で対象セットを選んで設定します。</p>
        </section>

        <section className="help-section">
          <h2>ステートセレクタ</h2>
          <p>状態を増減する論理ボタン、状態数、初期状態、各状態で保持するゲーム基板出力を編集します。</p>
        </section>

        <section className="help-section">
          <h2>割り当て一覧</h2>
          <p>論理ボタンごとの直接出力、連射、マクロ、ステートセレクタの割り当てをまとめて確認します。表示するマクロセットを切り替えて比較できます。</p>
        </section>
      </article>
    </main>
  );
}
