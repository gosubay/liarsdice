'use client';

import { useEffect, useMemo, useState } from 'react';
import { Die } from './die';
import { BLUFF, CHALLENGE, VALUE_STRONG, VALUE_THIN, raiseColour } from './palette';
import { loadPolicy, type Policy } from './policy';

type Language = 'en' | 'zh';

const QUANTITIES = [0, 2, 3, 4, 5, 6, 7];
const FACES = [1, 2, 3, 4, 5, 6];

type Arrange = 'wilds' | 'shape' | 'order';
const ARRANGES: Arrange[] = ['wilds', 'shape', 'order'];

// Poker-style shapes, strongest first. They partition all 252 hands: 6 / 30 / 30 /
// 60 / 60 / 60 / 6. Wild ones are deliberately NOT folded into the shape name — the
// name describes the dice as rolled, so 11223 is listed as a two pair even though it
// plays as four twos. The legend says so, and inside a band hands are sorted by what
// they are really worth, so the honest strength still reads left to right.
const SHAPES = ['quints', 'quads', 'boat', 'trips', 'twopair', 'pair', 'straight'] as const;
type Shape = (typeof SHAPES)[number];

const SHAPE_BY_SIGNATURE: Record<string, Shape> = {
  '5': 'quints',
  '41': 'quads',
  '32': 'boat',
  '311': 'trips',
  '221': 'twopair',
  '2111': 'pair',
  '11111': 'straight',
};

function counts(hand: string) {
  const out = new Map<number, number>();
  for (const char of hand) {
    const die = Number(char);
    out.set(die, (out.get(die) ?? 0) + 1);
  }
  return out;
}

function shapeOf(hand: string): Shape {
  const signature = [...counts(hand).values()].sort((a, b) => b - a).join('');
  return SHAPE_BY_SIGNATURE[signature] ?? 'straight';
}

// How many of a single face the hand can actually show, wild ones counted in.
function effectiveTop(hand: string) {
  const c = counts(hand);
  const wilds = c.get(1) ?? 0;
  let best = wilds;
  for (let f = 2; f <= 6; f += 1) best = Math.max(best, (c.get(f) ?? 0) + wilds);
  return best;
}

const solverCopy = {
  en: {
    kicker: 'Solved with counterfactual regret minimisation',
    title: 'Solver output',
    intro: 'Set the bid your opponent just made. The grid recolours to show what the solver does with every one of the 252 hands you could be holding.',
    currentBid: 'Current bid',
    nothing: 'Nothing (You open)',
    diceFace: 'Dice face',
    bidType: 'Bid type',
    wild: 'Wild 万能',
    zhai: 'Zhai 斋',
    facing: 'You are facing:',
    facingNone: 'Nothing — you bid first',
    of: '×',
    faceNames: ['', 'ones', 'twos', 'threes', 'fours', 'fives', 'sixes'],
    wildRow: ['no wild ones', 'one wild one', 'two wild ones', 'three wild ones', 'four wild ones', 'five wild ones'],
    yourHand: 'Your hand',
    frequency: 'Comes up in',
    ofRolls: 'of rolls',
    whatToDo: 'What to do',
    challenge: 'Challenge 开',
    held: 'you hold',
    zhaiShort: 'zhai',
    noData: 'This hand never faces this bid in the solve.',
    pocket: 'Challenge rate by your support',
    pocketNote: 'How often the solver challenges this bid, grouped by how many matching dice you hold. This is the part worth memorising.',
    pocketNone: 'Nothing to challenge yet — you are making the opening bid.',
    legendCall: 'Challenge',
    legendBluff: 'Raise, holding none of that face',
    legendThin: 'Raise, holding one',
    legendStrong: 'Raise, holding two or more',
    legendNote: 'Rows group hands by wild ones. Within a row, sixes-heavy hands sit left.',
    legendNoteShape: 'Rows group hands by poker shape. The shape name ignores wild ones — 11223 is listed as two pair, but it plays as four twos. Within a row, the genuinely strongest hands sit left.',
    legendNoteOrder: 'All 252 hands in ascending order. Use this one to find the hand you are actually holding.',
    arrange: 'Arrange by',
    arrangeNames: { wilds: 'Wild ones', shape: 'Shape', order: 'Order' },
    shapeRow: { quints: 'Quints', quads: 'Quads', boat: 'Full house', trips: 'Trips', twopair: 'Two pair', pair: 'One pair', straight: 'Straight' },
    handsWord: 'hands',
    orderLabel: 'ascending',
    caveat: 'Solver preview, not final. This policy folds the whole bid history into just the current bid, caps quantity at seven, and contains no zhai entry from a normal bid and no fei break-out. Treat it as strong guidance, not gospel.',
    loading: 'Loading solved strategy…',
    support: 'Matching dice you hold',
  },
  zh: {
    kicker: '以反事实遗憾最小化求解',
    title: '求解结果',
    intro: '设定对手刚叫的骰。下方图格会重新着色，显示你手上 252 种牌型各自该怎么打。',
    currentBid: '当前叫骰',
    nothing: '尚未叫骰（你先叫）',
    diceFace: '点数',
    bidType: '叫骰方式',
    wild: '万能',
    zhai: '斋',
    facing: '你面对：',
    facingNone: '尚未叫骰 — 你先开口',
    of: '个',
    faceNames: ['', '一点', '二点', '三点', '四点', '五点', '六点'],
    wildRow: ['没有万能一点', '一个万能一点', '两个万能一点', '三个万能一点', '四个万能一点', '五个万能一点'],
    yourHand: '你的骰',
    frequency: '出现机率',
    ofRolls: '',
    whatToDo: '建议打法',
    challenge: '开',
    held: '手上有',
    zhaiShort: '斋',
    noData: '此牌型在求解中不会面对这个叫骰。',
    pocket: '按手上符合骰数的开骰率',
    pocketNote: '依你手上符合的骰子数量，统计求解器开骰的频率。这一段最值得背下来。',
    pocketNone: '尚无叫骰可开 — 这一手由你先叫。',
    legendCall: '开',
    legendBluff: '加叫到完全没有的点数',
    legendThin: '加叫到只有一粒的点数',
    legendStrong: '加叫到有两粒以上的点数',
    legendNote: '每一行按万能一点的数量分组。同一行内，六点多的牌型排在左边。',
    legendNoteShape: '每一行按牌型分组。牌型名称不把万能一点算进去 — 11223 名义上是两对，实际打起来是四粒二点。同一行内，真正强的牌排在左边。',
    legendNoteOrder: '252 种牌型由小到大排列。想查自己手上那一手，用这个排法最快。',
    arrange: '排列方式',
    arrangeNames: { wilds: '万能一点', shape: '牌型', order: '顺序' },
    shapeRow: { quints: '五条', quads: '四条', boat: '葫芦', trips: '三条', twopair: '两对', pair: '一对', straight: '顺子' },
    handsWord: '种',
    orderLabel: '由小到大',
    caveat: '求解预览，非最终版。此策略把完整叫骰历史压缩成当前叫骰，数量上限为七，且不含由普通叫骰转斋与飞。可作强力参考，但非定论。',
    loading: '载入求解策略中…',
    support: '你手上符合的骰数',
  },
} as const;

function support(hand: string, face: number, zhai: boolean) {
  let n = 0;
  for (const char of hand) {
    const die = Number(char);
    if (die === face) n += 1;
    else if (!zhai && die === 1 && face !== 1) n += 1;
  }
  return n;
}

function parseBid(action: string) {
  const match = action.match(/BID_Q(\d+)_F(\d)(_ZHAI)?/);
  if (!match) return null;
  const face = Number(match[2]);
  return { quantity: Number(match[1]), face, zhai: Boolean(match[3]) || face === 1 };
}

const stateFor = (quantity: number, face: number, zhai: boolean) =>
  (quantity === 0 ? 'Q0_F0_WILD' : `Q${quantity}_F${face}_${zhai ? 'ZHAI' : 'WILD'}`);

export function SolverGrid({ language }: { language: Language }) {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [quantity, setQuantity] = useState(0);
  const [face, setFace] = useState(6);
  const [zhai, setZhai] = useState(false);
  const [selected, setSelected] = useState('11346');
  const [arrange, setArrange] = useState<Arrange>('wilds');
  const t = solverCopy[language];

  useEffect(() => {
    let live = true;
    loadPolicy()
      .then((data) => { if (live) setPolicy(data); })
      .catch(() => undefined);
    return () => { live = false; };
  }, []);

  const stateKeys = useMemo(() => new Set(policy?.states ?? []), [policy]);
  const available = useMemo(
    () => (q: number, f: number, z: boolean) => stateKeys.has(stateFor(q, f, z)),
    [stateKeys],
  );

  // The picked face and mode may not exist as a bid the solver has an answer for
  // (2 x sixes only exists as zhai, for instance). Slide to the nearest one that does.
  const resolved = useMemo(() => {
    if (quantity === 0) return { face, zhai: false };
    if (available(quantity, face, zhai)) return { face, zhai };
    if (available(quantity, face, !zhai)) return { face, zhai: !zhai };
    const sameMode = FACES.find((f) => available(quantity, f, zhai));
    if (sameMode) return { face: sameMode, zhai };
    const otherMode = FACES.find((f) => available(quantity, f, !zhai));
    if (otherMode) return { face: otherMode, zhai: !zhai };
    return { face, zhai };
  }, [quantity, face, zhai, available]);

  const state = stateFor(quantity, resolved.face, resolved.zhai);
  const effectiveZhai = quantity !== 0 && (resolved.zhai || resolved.face === 1);

  // One shape for all three arrangements: a stack of labelled bands of hands.
  const bands = useMemo(() => {
    type Band = { key: string; lead: string; sub: string; hands: string[] };
    if (!policy) return [] as Band[];

    if (arrange === 'order') {
      const hands = [...policy.hands].sort();
      return [{ key: 'all', lead: String(hands.length), sub: t.orderLabel, hands }];
    }

    if (arrange === 'shape') {
      // Ties fall back to the policy's own display order, which already puts
      // sixes-heavy hands first, so the left-to-right read never goes random.
      const rank = new Map(policy.hands.map((hand, i) => [hand, i]));
      const grouped: Band[] = [];
      for (const shape of SHAPES) {
        const hands = policy.hands
          .filter((hand) => shapeOf(hand) === shape)
          .sort((a, b) => effectiveTop(b) - effectiveTop(a) || (rank.get(a) ?? 0) - (rank.get(b) ?? 0));
        if (hands.length) grouped.push({ key: shape, lead: t.shapeRow[shape], sub: `${hands.length} ${t.handsWord}`, hands });
      }
      return grouped;
    }

    const grouped: Band[] = [];
    for (let wilds = 0; wilds <= 5; wilds += 1) {
      const hands = policy.hands.filter((hand) => (hand.match(/1/g) ?? []).length === wilds);
      if (hands.length) grouped.push({ key: `wild${wilds}`, lead: String(wilds), sub: t.wildRow[wilds], hands });
    }
    return grouped;
  }, [policy, arrange, t]);

  const detail = useMemo(() => {
    if (!policy) return [] as { action: string; p: number }[];
    const row = policy.d[selected]?.[state] ?? [];
    return row
      .map(([index, permille]) => ({ action: policy.acts[index], p: permille / 1000 }))
      .filter((entry) => entry.p >= 0.005)
      .sort((a, b) => b.p - a.p);
  }, [policy, selected, state]);

  const pocket = useMemo(() => {
    if (!policy || quantity === 0) return [] as { s: number; pct: number | null }[];
    const rows = Array.from({ length: 6 }, () => [0, 0]);
    policy.hands.forEach((hand, i) => {
      const row = policy.d[hand]?.[state];
      if (!row) return;
      const weight = policy.w[i];
      let call = 0;
      for (const [index, permille] of row) if (policy.acts[index] === 'CALL') call = permille / 1000;
      const held = support(hand, resolved.face, effectiveZhai);
      rows[held][0] += weight * call;
      rows[held][1] += weight;
    });
    return rows.map((entry, s) => ({ s, pct: entry[1] ? (entry[0] / entry[1]) * 100 : null }));
  }, [policy, state, resolved.face, effectiveZhai, quantity]);

  if (!policy) {
    return <section className="gto-shell"><p className="gto-loading">{t.loading}</p></section>;
  }

  // Four buckets, in the order they are drawn: ending the auction, then raises
  // ordered by how much of the target face the hand actually holds.
  const mixFor = (hand: string) => {
    const out = { call: 0, bluff: 0, thin: 0, strong: 0 };
    const row = policy.d[hand]?.[state];
    if (!row) return out;
    for (const [index, permille] of row) {
      const action = policy.acts[index];
      const p = permille / 1000;
      if (action === 'CALL') { out.call += p; continue; }
      const bid = parseBid(action);
      if (!bid) continue;
      const held = support(hand, bid.face, bid.zhai);
      if (held === 0) out.bluff += p;
      else if (held === 1) out.thin += p;
      else out.strong += p;
    }
    return out;
  };

  const weight = policy.w[policy.hands.indexOf(selected)] ?? 0;
  const legendNote = arrange === 'shape' ? t.legendNoteShape : arrange === 'order' ? t.legendNoteOrder : t.legendNote;

  return (
    <section className="gto-shell">
      <header className="gto-intro">
        <p className="gto-kicker">{t.kicker}</p>
        <h1 className="gto-title">{t.title}</h1>
        <p className="gto-lede">{t.intro}</p>
      </header>

      <div className="gto-board">
        <div className="gto-control gto-control-wide">
          <h2 className="gto-control-head">{t.currentBid}</h2>
          <div className="gto-chips">
            {QUANTITIES.map((q) => (
              <button
                key={q}
                type="button"
                className={`gto-chip ${q === 0 ? 'gto-chip-wide' : ''} ${quantity === q ? 'selected' : ''}`}
                aria-pressed={quantity === q}
                onClick={() => setQuantity(q)}
              >
                {q === 0 ? t.nothing : q}
              </button>
            ))}
          </div>
        </div>

        <div className={`gto-control ${quantity === 0 ? 'gto-dim' : ''}`}>
          <h2 className="gto-control-head">{t.diceFace}</h2>
          <div className="gto-faces">
            {FACES.map((f) => {
              const dead = quantity !== 0 && !available(quantity, f, zhai) && !available(quantity, f, !zhai);
              return (
                <button
                  key={f}
                  type="button"
                  className={`gto-face ${resolved.face === f && quantity !== 0 ? 'selected' : ''} ${dead ? 'dead' : ''}`}
                  aria-pressed={resolved.face === f && quantity !== 0}
                  aria-label={t.faceNames[f]}
                  disabled={quantity === 0 || dead}
                  onClick={() => setFace(f)}
                >
                  <Die value={f} accent={f === 1} />
                </button>
              );
            })}
          </div>
        </div>

        <div className={`gto-control ${quantity === 0 ? 'gto-dim' : ''}`}>
          <h2 className="gto-control-head">{t.bidType}</h2>
          <div className="gto-chips">
            {[false, true].map((z) => {
              const dead = quantity !== 0 && !available(quantity, resolved.face, z);
              return (
                <button
                  key={String(z)}
                  type="button"
                  className={`gto-chip ${effectiveZhai === z && quantity !== 0 ? 'selected' : ''} ${dead ? 'dead' : ''}`}
                  aria-pressed={effectiveZhai === z && quantity !== 0}
                  disabled={quantity === 0 || dead || resolved.face === 1}
                  onClick={() => setZhai(z)}
                >
                  {z ? t.zhai : t.wild}
                </button>
              );
            })}
          </div>
        </div>

        <div className="gto-facing">
          <span>{t.facing}</span>
          {quantity === 0 ? (
            <b className="gto-facing-none">{t.facingNone}</b>
          ) : (
            <b>
              {quantity} {t.of} {t.faceNames[resolved.face]}
              {effectiveZhai && <em>{t.zhaiShort}</em>}
            </b>
          )}
        </div>
      </div>

      <div className="gto-split">
        <div className="gto-gridbox">
          <div className="gto-arrange">
            <span className="gto-control-head">{t.arrange}</span>
            {ARRANGES.map((mode) => (
              <button
                key={mode}
                type="button"
                className={`gto-chip gto-chip-sm ${arrange === mode ? 'selected' : ''}`}
                aria-pressed={arrange === mode}
                onClick={() => setArrange(mode)}
              >
                {t.arrangeNames[mode]}
              </button>
            ))}
          </div>
          <div className="gto-scroller">
            {bands.map((band) => (
              <div className="gto-band" key={band.key}>
                <div className={`gto-band-label ${arrange === 'wilds' ? '' : 'gto-band-label-name'}`}><b>{band.lead}</b><span>{band.sub}</span></div>
                <div className="gto-cells">
                  {band.hands.map((hand) => {
                    const mix = mixFor(hand);
                    const total = Math.max(mix.call + mix.bluff + mix.thin + mix.strong, 0.0001);
                    const segments = [
                      { key: 'call', pct: (mix.call / total) * 100, colour: CHALLENGE },
                      { key: 'bluff', pct: (mix.bluff / total) * 100, colour: BLUFF },
                      { key: 'thin', pct: (mix.thin / total) * 100, colour: VALUE_THIN },
                      { key: 'strong', pct: (mix.strong / total) * 100, colour: VALUE_STRONG },
                    ];
                    let offset = 0;
                    return (
                      <button
                        key={hand}
                        type="button"
                        className={`gto-cell ${hand === selected ? 'selected' : ''}`}
                        aria-label={hand}
                        aria-pressed={hand === selected}
                        onClick={() => setSelected(hand)}
                      >
                        {segments.map((segment) => {
                          const left = offset;
                          offset += segment.pct;
                          // A 2px gap keeps thin adjacent segments from blurring together.
                          if (segment.pct <= 0) return null;
                          return (
                            <i
                              key={segment.key}
                              style={{ left: `${left}%`, width: `calc(${segment.pct}% - 2px)`, background: segment.colour }}
                            />
                          );
                        })}
                        <span>{hand}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="gto-legend">
            <span><em style={{ background: CHALLENGE }} />{t.legendCall}</span>
            <span><em style={{ background: BLUFF }} />{t.legendBluff}</span>
            <span><em style={{ background: VALUE_THIN }} />{t.legendThin}</span>
            <span><em style={{ background: VALUE_STRONG }} />{t.legendStrong}</span>
            <small>{legendNote}</small>
          </div>
        </div>

        <aside className="gto-side">
          <div className="gto-card">
            <h3>{t.yourHand}</h3>
            <div className="gto-hand">
              {selected.split('').map((d, i) => <Die key={`${selected}-${i}`} value={Number(d)} accent={d === '1'} />)}
            </div>
            <p className="gto-freq">{t.frequency} {weight.toFixed(2)}% {t.ofRolls}</p>
            <h3 className="gto-subhead">{t.whatToDo}</h3>
            <div className="gto-acts">
              {detail.length === 0 && <p className="gto-freq">{t.noData}</p>}
              {detail.map((entry) => {
                const bid = entry.action === 'CALL' ? null : parseBid(entry.action);
                const held = bid ? support(selected, bid.face, bid.zhai) : 0;
                const colour = bid ? raiseColour(held) : CHALLENGE;
                return (
                  <div className="gto-act" key={entry.action}>
                    <span className="gto-act-label">
                      <u style={{ width: `${entry.p * 100}%`, background: colour }} />
                      <s>
                        {bid
                          ? `${bid.quantity} ${t.of} ${t.faceNames[bid.face]}${bid.zhai ? ` ${t.zhaiShort}` : ''} · ${t.held} ${held}`
                          : t.challenge}
                      </s>
                    </span>
                    <span className="gto-act-pct">{(entry.p * 100).toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="gto-card">
            <h3>{t.pocket}</h3>
            {quantity === 0 ? (
              <p className="gto-freq">{t.pocketNone}</p>
            ) : (
              <>
                <div className="gto-bars">
                  {pocket.map((row) => (
                    <div className="gto-bar" key={row.s}>
                      <span className="gto-bar-k">{row.s}</span>
                      <span className="gto-bar-track">{row.pct !== null && <i style={{ width: `${row.pct}%` }} />}</span>
                      <span className="gto-bar-v">{row.pct === null ? '—' : `${row.pct.toFixed(0)}%`}</span>
                    </div>
                  ))}
                </div>
                <p className="gto-freq gto-bar-legend">{t.support}</p>
              </>
            )}
            <p className="gto-note">{t.pocketNote}</p>
          </div>
        </aside>
      </div>

      <p className="gto-caveat">{t.caveat}</p>
    </section>
  );
}

