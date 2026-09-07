'use client';

// The Math tab. Every figure is computed here from the binomial, not hard-coded,
// so the page can never drift from the arithmetic it is explaining.

import { useMemo, useState } from 'react';
import { Die } from './die';

type Language = 'en' | 'zh';

const choose = (n: number, k: number) => {
  let result = 1;
  for (let i = 0; i < k; i += 1) result = (result * (n - i)) / (i + 1);
  return result;
};
const binomial = (n: number, k: number, p: number) => choose(n, k) * p ** k * (1 - p) ** (n - k);

const P_WILD = 1 / 3;
const P_ZHAI = 1 / 6;

const copy = {
  en: {
    kicker: 'The arithmetic underneath the game',
    title: 'Why a one is worth two dice',
    lede: 'Everything in Liar’s Dice comes from two numbers: how likely a single unknown die is to match your bid, and how those chances stack up across five of them. Get these and the rest of the game is bookkeeping.',

    oneDieHead: 'Step one · a single die',
    oneDieNote: 'A die has six faces, so any particular face shows up one time in six. The wild one changes that — for a normal bid, a one counts as your face too, so two of the six faces match instead of one.',
    normalBid: 'Normal bid on 2–6',
    normalBidWhy: 'Your face, or a wild one',
    zhaiBid: 'Zhai bid, or any bid on ones',
    zhaiBidWhy: 'Only the face itself',
    perDie: 'per unknown die',
    doubles: 'The wild one exactly doubles your chances. That single fact is why a zhai bid of n is worth roughly a wild bid of 2n.',

    expectedHead: 'Step two · what to expect from five dice',
    expectedNote: 'Multiply the per-die chance by how many dice you cannot see. This is the number to hold in your head when someone bids.',
    fiveHidden: 'Opponent’s 5 hidden dice',
    tenTotal: 'All 10 dice on the table',
    expect: 'expect',
    matches: 'matches',

    distHead: 'Step three · the spread, not just the average',
    distNote: 'Averages hide the risk. Below is exactly how often five unknown dice contain 0, 1, 2, 3, 4 or 5 matches. Note how fat the left side of the zhai bars is — nearly half the time your opponent has nothing at all.',
    exactly: 'Exactly this many matches in five dice',
    atLeast: 'At least this many',
    showExact: 'Exactly',
    showCumulative: 'At least',
    countAxis: 'matches in five dice',

    tableHead: 'Step four · the table you actually use',
    tableNote: 'At the table you never ask "what is the average". You ask: the bid is Q, I hold K, so my opponent needs Q − K. This is that question answered.',
    needs: 'Opponent needs',
    fromFive: 'Chance their five dice deliver it',
    gapNote: 'Compare these to what the solver does. It treats wild gap 3 (a 21% bid) as a coin flip, not an easy challenge — because the fact that they bid it tells you they are not a random hand.',

    footnote: 'All figures are exact, not simulated: 3^5 = 243 outcomes for a wild face and 6^5 = 7,776 for a zhai face.',
  },
  zh: {
    kicker: '游戏底下的算术',
    title: '为什么一点值两粒骰',
    lede: '大话骰的一切都来自两个数字：一粒未知骰符合叫骰的机率，以及这些机率在五粒骰上如何叠加。掌握这两点，其余都只是记帐。',

    oneDieHead: '第一步 · 单粒骰',
    oneDieNote: '一粒骰有六面，任一特定点数出现的机率是六分之一。万能一点改变了这件事 — 普通叫骰时，一点也算你的点数，六面里有两面符合而非一面。',
    normalBid: '二至六点的普通叫骰',
    normalBidWhy: '该点数，或万能一点',
    zhaiBid: '斋叫，或任何叫一点',
    zhaiBidWhy: '只算该点数本身',
    perDie: '每粒未知骰',
    doubles: '万能一点正好让机率翻倍。这一件事，就是「n 个斋约等于 2n 个万能」的全部原因。',

    expectedHead: '第二步 · 五粒骰的期望值',
    expectedNote: '把单粒机率乘上你看不到的骰数。有人叫骰时，这就是你该记在脑中的数字。',
    fiveHidden: '对手的 5 粒暗骰',
    tenTotal: '桌上全部 10 粒骰',
    expect: '期望',
    matches: '粒符合',

    distHead: '第三步 · 看分布，不只看平均',
    distNote: '平均值会掩盖风险。下方是五粒未知骰恰好含有 0、1、2、3、4、5 粒符合的确切机率。注意斋的长条左侧有多厚 — 将近一半的时候对手一粒都没有。',
    exactly: '五粒骰中恰好有这么多粒符合',
    atLeast: '至少有这么多粒',
    showExact: '恰好',
    showCumulative: '至少',
    countAxis: '粒符合（五粒骰中）',

    tableHead: '第四步 · 你真正会用到的表',
    tableNote: '在酒桌上你不会问「平均是多少」。你会问：叫骰是 Q，我手上有 K，所以对手需要 Q − K。这张表就是答案。',
    needs: '对手需要',
    fromFive: '他五粒骰凑得出的机率',
    gapNote: '把这些和求解器的行为对照。它把万能差额 3（只有 21% 成立的叫骰）当成五五开，而不是白赚的开骰 — 因为「他敢这样叫」本身就说明他不是随机的手牌。',

    footnote: '所有数字均为精确值而非模拟：万能点数共 3^5 = 243 种结果，斋点数共 6^5 = 7,776 种结果。',
  },
} as const;

export function MathPage({ language }: { language: Language }) {
  const t = copy[language];
  const [mode, setMode] = useState<'exact' | 'atLeast'>('exact');

  const rows = useMemo(() => {
    const build = (p: number) => {
      const exact = Array.from({ length: 6 }, (_, k) => binomial(5, k, p));
      const atLeast = exact.map((_, k) => exact.slice(k).reduce((sum, v) => sum + v, 0));
      return { exact, atLeast };
    };
    return { wild: build(P_WILD), zhai: build(P_ZHAI) };
  }, []);

  const series = mode === 'exact'
    ? { wild: rows.wild.exact, zhai: rows.zhai.exact }
    : { wild: rows.wild.atLeast, zhai: rows.zhai.atLeast };
  const peak = Math.max(...series.wild, ...series.zhai);

  const pct = (v: number, dp = 1) => `${(v * 100).toFixed(dp)}%`;

  return (
    <section className="math-shell">
      <header className="math-intro">
        <p className="math-kicker">{t.kicker}</p>
        <h1 className="math-title">{t.title}</h1>
        <p className="math-lede">{t.lede}</p>
      </header>

      {/* ---- one die ---- */}
      <section className="math-step">
        <h2>{t.oneDieHead}</h2>
        <p className="math-note">{t.oneDieNote}</p>
        <div className="odds-pair">
          <div className="odds-card wild">
            <div className="odds-faces">
              <Die value={5} /><span className="odds-plus">+</span><Die value={1} accent />
            </div>
            <b>{t.normalBid}</b>
            <small>{t.normalBidWhy}</small>
            <em>2⁄6 = 1⁄3</em>
            <span className="odds-per">33.3% · {t.perDie}</span>
          </div>
          <div className="odds-card zhai">
            <div className="odds-faces">
              <Die value={5} />
            </div>
            <b>{t.zhaiBid}</b>
            <small>{t.zhaiBidWhy}</small>
            <em>1⁄6</em>
            <span className="odds-per">16.7% · {t.perDie}</span>
          </div>
        </div>
        <p className="math-callout">{t.doubles}</p>
      </section>

      {/* ---- expected ---- */}
      <section className="math-step">
        <h2>{t.expectedHead}</h2>
        <p className="math-note">{t.expectedNote}</p>
        <div className="expect-grid">
          {[
            { label: t.fiveHidden, n: 5 },
            { label: t.tenTotal, n: 10 },
          ].map((group) => (
            <div className="expect-card" key={group.n}>
              <h4>{group.label}</h4>
              <div className="expect-row wild">
                <span>{t.normalBid}</span>
                <b>{(group.n * P_WILD).toFixed(2)}</b>
                <small>{t.matches}</small>
              </div>
              <div className="expect-row zhai">
                <span>{t.zhaiBid}</span>
                <b>{(group.n * P_ZHAI).toFixed(2)}</b>
                <small>{t.matches}</small>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---- distribution chart ---- */}
      <section className="math-step">
        <h2>{t.distHead}</h2>
        <p className="math-note">{t.distNote}</p>

        <div className="chart-head">
          <div className="chart-toggle">
            <button type="button" className={mode === 'exact' ? 'selected' : ''} aria-pressed={mode === 'exact'} onClick={() => setMode('exact')}>{t.showExact}</button>
            <button type="button" className={mode === 'atLeast' ? 'selected' : ''} aria-pressed={mode === 'atLeast'} onClick={() => setMode('atLeast')}>{t.showCumulative}</button>
          </div>
          <div className="chart-key">
            <span><i className="key wild" />{t.normalBid}</span>
            <span><i className="key zhai" />{t.zhaiBid}</span>
          </div>
        </div>

        <div className="chart">
          {[0, 1, 2, 3, 4, 5].map((k) => (
            <div className="chart-col" key={k}>
              <div className="chart-bars">
                <span className="chart-bar wild" style={{ height: `${(series.wild[k] / peak) * 100}%` }}>
                  <em>{pct(series.wild[k], series.wild[k] < 0.01 ? 2 : 1)}</em>
                </span>
                <span className="chart-bar zhai" style={{ height: `${(series.zhai[k] / peak) * 100}%` }}>
                  <em>{pct(series.zhai[k], series.zhai[k] < 0.01 ? 2 : 1)}</em>
                </span>
              </div>
              <span className="chart-x">{k}</span>
            </div>
          ))}
        </div>
        <p className="chart-axis">{t.countAxis}</p>
      </section>

      {/* ---- the practical table ---- */}
      <section className="math-step">
        <h2>{t.tableHead}</h2>
        <p className="math-note">{t.tableNote}</p>
        <div className="need-table">
          <div className="need-row head">
            <span>{t.needs}</span>
            <span className="need-col wild">{t.normalBid}</span>
            <span className="need-col zhai">{t.zhaiBid}</span>
          </div>
          {[0, 1, 2, 3, 4, 5].map((r) => (
            <div className="need-row" key={r}>
              <span className="need-k">{r}</span>
              <span className="need-col wild">
                <i style={{ width: `${rows.wild.atLeast[r] * 100}%` }} />
                <b>{pct(rows.wild.atLeast[r], rows.wild.atLeast[r] < 0.01 ? 2 : 1)}</b>
              </span>
              <span className="need-col zhai">
                <i style={{ width: `${rows.zhai.atLeast[r] * 100}%` }} />
                <b>{pct(rows.zhai.atLeast[r], rows.zhai.atLeast[r] < 0.01 ? 2 : 1)}</b>
              </span>
            </div>
          ))}
        </div>
        <p className="math-callout">{t.gapNote}</p>
      </section>

      <p className="math-foot">{t.footnote}</p>
    </section>
  );
}
