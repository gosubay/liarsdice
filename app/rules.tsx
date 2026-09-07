'use client';

// The Rules tab. This is the human-readable statement of the variant the Play tab
// enforces — if a rule changes in code, change it here in the same commit.

import { Die } from './die';

type Language = 'en' | 'zh';

const copy = {
  en: {
    kicker: 'China KTV rules · two players · five dice each',
    title: 'How this variant plays',
    lede: 'A round is one auction. Players take turns naming a bid about all ten dice on the table, each bid higher than the last, until somebody stops believing and calls. Whoever is wrong takes the loss.',

    basicsHead: 'The table',
    basics: [
      { t: 'Five dice each, every round', d: 'Both players roll five dice and keep them hidden. Dice are never removed — you always have five, however far behind you are.' },
      { t: 'The loser of a round starts the next', d: 'Taking a loss gives you the opening bid, which is a real advantage. Losing is not purely punishment.' },
      { t: 'Match length is your choice', d: 'First to five losses, or unlimited. More loss points is worse.' },
    ],

    faceHead: 'Face order',
    faceNote: 'Bids climb this ladder. At the same quantity you may only move right — never back down it.',
    faceTail: 'Ones are the highest face, not the lowest. That is what makes them worth converting to.',

    wildHead: 'The wild one',
    wild: [
      { t: 'On a normal bid, ones count as your face', d: 'Bid 4 × fives and every five plus every one on the table counts toward it. Each unknown die matches one time in three.' },
      { t: 'Zhai 斋 switches wilds off', d: 'A zhai bid counts only the face itself. Each unknown die now matches one time in six, so a zhai bid of n is worth roughly a normal bid of 2n.' },
      { t: 'A bid on ones is always zhai', d: 'Ones cannot be wild for themselves, so there is no such thing as a normal bid on ones.' },
    ],

    bidHead: 'Making a bid',
    minTitle: 'Opening minimums',
    minNote: 'The first bid of a round must be at least one of these. After that every bid simply has to beat the one before, so the floor never binds again.',
    mins: [
      { q: 3, label: 'Wild 万能', sub: 'on faces 2–6' },
      { q: 2, label: 'Zhai 斋', sub: 'on faces 2–6' },
      { q: 2, label: 'Ones 一点', sub: 'always zhai' },
    ],
    raiseTitle: 'Raising',
    raises: [
      { t: 'Raise the quantity', d: 'Any higher quantity is legal, on any face. 4 × threes beats 3 × sixes.' },
      { t: 'Or keep the quantity and climb the face', d: 'Same number, higher face on the ladder above. 3 × sixes beats 3 × fives.' },
      { t: 'Entering zhai keeps the quantity but needs a higher face', d: '4 × fives normal may be followed by 4 × sixes zhai. The same face at the same quantity is not a raise.' },
      { t: 'Fei 飞 breaks out of zhai', d: 'To go back to a normal bid after a zhai bid, name at least double the quantity. 3 × sixes zhai is broken by 6 × any face normal.' },
    ],

    strHead: 'The straight',
    strBody: 'If your five dice show five different faces you may re-roll all five, once, before you bid. It is optional and the choice is yours — a straight is a weak hand for bidding but the re-roll can land you somewhere worse.',

    endHead: 'Calling',
    end: [
      { t: 'Call 开 to end the auction', d: 'The dice come up and every matching die across both players is counted against the bid.' },
      { t: 'If the count reaches the bid, the caller loses', d: 'The bidder was telling the truth, or got lucky. Either way the challenger takes the loss point.' },
      { t: 'If it falls short, the bidder loses', d: 'The bluff is caught.' },
    ],

    foot: 'The Solver and GTO Strategy tabs are built on these exact rules, with two simplifications: the solve caps quantity at seven of ten, and it does not model entering zhai from a normal bid or fei.',
  },
  zh: {
    kicker: '中国 KTV 酒桌规则 · 两人 · 各五粒骰',
    title: '本玩法怎么玩',
    lede: '一局就是一场喊价。双方轮流针对桌上全部十粒骰叫骰，一次比一次高，直到有人不信而开骰。喊错的人吃下这一负。',

    basicsHead: '桌面',
    basics: [
      { t: '每局各摇五粒骰', d: '双方各摇五粒并盖住。骰子永远不会被拿走 — 无论落后多少，你手上始终有五粒。' },
      { t: '输的一方下局先叫', d: '吃下一负，就换来开叫权，这是实打实的优势。输并不只是惩罚。' },
      { t: '局制自选', d: '先负五局，或无限局。负分越多越差。' },
    ],

    faceHead: '点数大小',
    faceNote: '叫骰沿着这个顺序往上爬。同样数量时只能往右移，不能回头。',
    faceTail: '一点是最大的点数，不是最小。这正是把牌转成一点的价值所在。',

    wildHead: '万能一点',
    wild: [
      { t: '普通叫骰时，一点算作你的点数', d: '叫「四个五」时，桌上每一粒五点加上每一粒一点都算数。每粒未知骰的符合机率是三分之一。' },
      { t: '斋会关掉万能', d: '斋叫只计该点数本身。每粒未知骰的符合机率降到六分之一，因此 n 个斋约等于 2n 个普通叫骰。' },
      { t: '叫一点必定是斋', d: '一点不能对自己万能，所以不存在「普通叫一点」这回事。' },
    ],

    bidHead: '怎么叫骰',
    minTitle: '开叫下限',
    minNote: '一局的第一次叫骰至少要达到下列其中一种。之后每次叫骰只要盖过前一次即可，下限不再起作用。',
    mins: [
      { q: 3, label: '万能', sub: '二至六点' },
      { q: 2, label: '斋', sub: '二至六点' },
      { q: 2, label: '一点', sub: '必定为斋' },
    ],
    raiseTitle: '加叫',
    raises: [
      { t: '提高数量', d: '任何更高的数量都合法，点数不限。「四个三」大过「三个六」。' },
      { t: '或维持数量，往上爬点数', d: '数量相同，点数在上方顺序中更大。「三个六」大过「三个五」。' },
      { t: '转斋可维持数量，但点数必须更大', d: '「四个五」普通之后，可以叫「四个六斋」。同数量同点数不算加叫。' },
      { t: '飞：破斋回到普通叫骰', d: '斋叫之后要回到普通叫骰，必须至少叫双倍数量。「三个六斋」需以「六个任何点数」普通来破。' },
    ],

    strHead: '顺子',
    strBody: '若你的五粒骰是五个不同点数，可在叫骰前选择重摇全部五粒，仅一次。这是选择性的，由你决定 — 顺子拿来叫骰偏弱，但重摇也可能摇到更差。',

    endHead: '开骰',
    end: [
      { t: '开骰结束喊价', d: '双方掀骰，把两边所有符合的骰子加总，与叫骰比较。' },
      { t: '数量够，开的人输', d: '叫骰的人说了真话，或运气好。无论如何，开的人吃下这一负。' },
      { t: '数量不够，叫的人输', d: '诈唬被抓到。' },
    ],

    foot: '「求解器」与「GTO 策略」两页都建立在以上规则之上，但有两点简化：求解的数量上限为十粒中的七粒，且未模拟由普通叫骰转斋与飞。',
  },
} as const;

const FACE_LADDER = [2, 3, 4, 5, 6, 1];

export function RulesPage({ language }: { language: Language }) {
  const t = copy[language];

  return (
    <section className="rules-shell">
      <header className="rules-intro">
        <p className="rules-kicker">{t.kicker}</p>
        <h1 className="rules-title">{t.title}</h1>
        <p className="rules-lede">{t.lede}</p>
      </header>

      <section className="rules-block">
        <h2>{t.basicsHead}</h2>
        <ul className="rules-list">
          {t.basics.map((item) => <li key={item.t}><b>{item.t}</b><p>{item.d}</p></li>)}
        </ul>
      </section>

      <section className="rules-block">
        <h2>{t.faceHead}</h2>
        <p className="rules-note">{t.faceNote}</p>
        <div className="ladder">
          {FACE_LADDER.map((face, i) => (
            <div className="ladder-step" key={face}>
              <Die value={face} accent={face === 1} />
              {i < FACE_LADDER.length - 1 && <span className="ladder-arrow">›</span>}
            </div>
          ))}
        </div>
        <p className="rules-note ladder-tail">{t.faceTail}</p>
      </section>

      <section className="rules-block">
        <h2>{t.wildHead}</h2>
        <ul className="rules-list">
          {t.wild.map((item) => <li key={item.t}><b>{item.t}</b><p>{item.d}</p></li>)}
        </ul>
      </section>

      <section className="rules-block">
        <h2>{t.bidHead}</h2>
        <h3 className="rules-sub">{t.minTitle}</h3>
        <p className="rules-note">{t.minNote}</p>
        <div className="min-row">
          {t.mins.map((min) => (
            <div className="min-card" key={min.label}>
              <strong>{min.q}</strong>
              <span className="min-times">×</span>
              <div><b>{min.label}</b><small>{min.sub}</small></div>
            </div>
          ))}
        </div>
        <h3 className="rules-sub">{t.raiseTitle}</h3>
        <ul className="rules-list">
          {t.raises.map((item) => <li key={item.t}><b>{item.t}</b><p>{item.d}</p></li>)}
        </ul>
      </section>

      <section className="rules-block">
        <h2>{t.strHead}</h2>
        <div className="straight-demo">
          {[2, 3, 4, 5, 6].map((face) => <Die key={face} value={face} />)}
        </div>
        <p className="rules-note">{t.strBody}</p>
      </section>

      <section className="rules-block">
        <h2>{t.endHead}</h2>
        <ul className="rules-list">
          {t.end.map((item) => <li key={item.t}><b>{item.t}</b><p>{item.d}</p></li>)}
        </ul>
      </section>

      <p className="rules-foot">{t.foot}</p>
    </section>
  );
}
