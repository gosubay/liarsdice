'use client';

// The 20-point cheat sheet. Every number here is measured from the shipped policy
// (app/gto-policy.json); see GTO_TAB_SPEC.md before changing any of them.

type Language = 'en' | 'zh';
type Rule = { title: string; body: string };
type Section = { heading: string; range: string; note: string; rules: Rule[] };

const GAP_WILD = [
  { gap: '≤ 1', pct: 0 }, { gap: '2', pct: 5 }, { gap: '3', pct: 43 },
  { gap: '4', pct: 91 }, { gap: '5+', pct: 100 },
];
const GAP_ZHAI = [
  { gap: '≤ 1', pct: 0 }, { gap: '2', pct: 50 }, { gap: '3', pct: 95 },
  { gap: '4', pct: 99 }, { gap: '5+', pct: 99 },
];

const copy = {
  en: {
    kicker: 'Twenty points from 16,380 solved decisions',
    title: 'The gap rule',
    lede: 'A solver played this game against itself until it stopped improving. Almost everything it learned collapses into one subtraction you can do at the table. The rest are corrections to instincts that feel right and lose.',
    heroLead: 'Count your matching dice. Subtract them from the bid.',
    heroSub: 'That number — the gap — is how many the opponent has to be holding. It decides whether you challenge, and little else matters.',
    wild: 'Wild 万能', wildNote: 'Ones count as matches',
    zhai: 'Zhai 斋', zhaiNote: 'Ones are dead',
    gapLabel: 'gap',
    challengeRate: 'How often the solver challenges',
    wildVerdict: 'Ride it to gap 2. Coin flip at gap 3. Challenge from gap 4.',
    zhaiVerdict: 'Everything shifts down one. Your tolerance in zhai is exactly one die tighter.',
    footnote: 'Measured across all 252 hands against 65 possible bids, weighted by how often each hand turns up. The solve is simplified: bid history is folded into the current bid, quantity is capped at seven, and it contains no zhai entry from a normal bid and no fei. Strong guidance for a KTV table, not a proof.',
    sections: [
      {
        heading: 'The rule itself', range: '01 — 03',
        note: 'These three points are the whole strategy compressed. The rest is refinement.',
        rules: [
          { title: 'Only the gap matters, not the bid.', body: 'Facing 5 × fours holding two fours is the same decision as facing 7 × sixes holding four sixes. Both are gap 3, and the solver treats them identically. Stop reading the quantity on its own.' },
          { title: 'In wild, gap 3 is the knife edge.', body: 'Below it the solver essentially never challenges — 0% at gap 1, 5% at gap 2. Above it, it essentially always does — 91% at gap 4. Gap 3 is the only spot where you genuinely have a choice.' },
          { title: 'In zhai, that edge moves to gap 2.', body: 'Each opponent die now matches one time in six instead of one in three. Gap 2 zhai challenges at 50%, gap 3 at 95%. Same shape, shifted one die tighter.' },
        ],
      },
      {
        heading: 'Why your arithmetic lies', range: '04 — 05',
        note: 'The two points most likely to change how you play tonight.',
        rules: [
          { title: 'The textbook odds tell you to challenge far too early.', body: 'At wild gap 3, five unknown dice supply three matches only 21% of the time — so the bid "should" be a lie 79% of the time and challenging looks free. The solver challenges just 43%. It is near indifferent, which means the real chance the bid is true is close to half, not a fifth.' },
          { title: 'Because the bidder is not a random hand.', body: 'They chose that face. Conditioning on the fact they said it out loud drags the true odds up enormously — here from 21% to roughly 50%. Whatever you compute from your own dice, shade it hard toward the bid being true.' },
        ],
      },
      {
        heading: 'Opening', range: '06 — 10',
        note: 'You open one round in two. It is the only bid with no information and total freedom.',
        rules: [
          { title: 'Two openings are standard, not one.', body: '66% of openings are 3 × a face wild. The other 34% are 2 × a face zhai. If you only ever open wild you are playing two-thirds of a strategy.' },
          { title: 'Bluff roughly one opening in six.', body: '16.8% of openings land on a face the opener holds none of. Never bluffing is exploitable — an opponent who knows you always have it can fold every marginal spot and challenge the rest.' },
          { title: 'Polarise. Open strong or open empty, not in between.', body: 'Pick a face at random and you hold three or more of it 16% of the time; the solver opens on such a face 31% of the time, nearly double. It correspondingly avoids faces it holds exactly one or two of. Middling openings are the ones that get raised off.' },
          { title: 'Never go zhai while you are holding wilds.', body: 'With zero to two ones the solver opens zhai about 35% of the time. Holding three or more ones that collapses to 6–19%. Zhai kills your own ones — you would be throwing away your best dice.' },
          { title: 'The standard value opening is two real copies.', body: '35% of openings sit on a face the opener physically holds two of. Two on the table plus a wild or two behind it is the bread-and-butter 3 × face, and it is true far more often than it looks.' },
        ],
      },
      {
        heading: 'Raising', range: '11 — 15',
        note: 'Below gap 3 you are not choosing whether to challenge. You are choosing how to raise.',
        rules: [
          { title: 'Same quantity and quantity-plus-one are both normal.', body: 'The split is close to 50/50 through most of the auction. Players who only bump the quantity, or only climb the face ladder, give away half their options.' },
          { title: 'Late in the auction, stop switching faces.', body: 'Facing 6 × anything, 80% of raises simply add one to the quantity. High up the ladder there is no room left to move sideways.' },
          { title: 'Raise onto a face you actually hold.', body: 'Between 89% and 97% of raises land on a face the raiser has at least one of. Bluffing forward is far rarer mid-auction than on the opening bid.' },
          { title: 'Do not parrot the face you were just given.', body: 'Facing 3 × sixes with nothing to three sixes, the solver stays on sixes only 2–21% of the time. Moving the auction onto your own face is the default, not a sign of weakness.' },
          { title: 'With nothing, raise — do not challenge.', body: 'Holding zero support against 3 ×, over a quarter of the solver’s raises go onto another face it also holds none of. An early bid you cannot beat is usually still true; bluffing forward beats challenging into it.' },
        ],
      },
      {
        heading: 'Hiding a big hand', range: '16 — 17',
        note: 'The most counter-intuitive part of the solve, and the one that wins rounds against people who know the basics.',
        rules: [
          { title: 'Never raise your own monster face.', body: 'Holding 66666 against 3 × sixes, the solver bids 4 × sixes only 6% of the time. It goes 3 × ones zhai (34%) or 4 × fives (30%) instead. Raising sixes announces you have sixes, and the auction dies where you cannot profit from it.' },
          { title: 'When your hand is ones, convert to ones.', body: 'Holding 11666 against 3 × sixes, the solver bids 3 × ones zhai 91% of the time. Ones sit at the top of the order, so nobody passes you without a large jump — and your own wilds stop being wasted.' },
        ],
      },
      {
        heading: 'Zhai economics', range: '18 — 20',
        note: 'Zhai is not a small adjustment to the bid. It changes the arithmetic of the whole round.',
        rules: [
          { title: 'A zhai bid of n is worth about a wild bid of 2n.', body: 'Ones stop counting, so the chance any unknown die matches halves from one in three to one in six. Read 3 × fives zhai as if someone had said 6 × fives.' },
          { title: 'Zhai auctions die fast.', body: 'At 4 × zhai the challenge rate is 95%. At 4 × wild it is 36%. Once someone goes zhai, expect the round to end within a bid or two — plan for that before you go there.' },
          { title: 'Nothing survives past seven.', body: 'At 7 × wild the solver challenges 97% of the time; at 7 × zhai, 99%. Bidding seven of ten dice is asking to be called. Do it holding the goods or not at all.' },
        ],
      },
    ] as Section[],
  },
  zh: {
    kicker: '从 16,380 个求解决策中归纳的二十条',
    title: '差额法则',
    lede: '求解器与自己对局至无法再进步。它学到的几乎一切，都可以浓缩成你在酒桌上就能做的一次减法。其余各条，是对那些「感觉对、其实会输」的直觉的修正。',
    heroLead: '数一数你手上符合的骰，用叫骰数量减去它。',
    heroSub: '这个数字就是差额 — 对手必须拿出的数量。它决定你开不开，其余影响都很小。',
    wild: '万能', wildNote: '一点计入',
    zhai: '斋', zhaiNote: '一点不计',
    gapLabel: '差额',
    challengeRate: '求解器开骰的频率',
    wildVerdict: '差额 2 以内继续叫。差额 3 是五五开。差额 4 起开骰。',
    zhaiVerdict: '整体往下移一格。斋的容忍度正好紧一粒骰。',
    footnote: '统计涵盖全部 252 种牌型对 65 种叫骰，并按各牌型出现机率加权。此求解经过简化：叫骰历史被压缩成当前叫骰，数量上限为七，且不含由普通叫骰转斋与飞。可作酒桌上的强力参考，但非定论。',
    sections: [
      {
        heading: '法则本身', range: '01 — 03',
        note: '这三条就是整套策略的浓缩，其余都是细化。',
        rules: [
          { title: '重要的是差额，不是叫骰本身。', body: '手握两粒四点面对「五个四」，与手握四粒六点面对「七个六」，是同一个决定。两者差额都是 3，求解器一视同仁。别再单看数量。' },
          { title: '万能局里，差额 3 是分水岭。', body: '在此之下几乎从不开骰 — 差额 1 是 0%，差额 2 是 5%。在此之上几乎必开 — 差额 4 是 91%。只有差额 3 才真正需要你选择。' },
          { title: '斋局里，分水岭移到差额 2。', body: '对手每粒骰的符合机率从三分之一降到六分之一。斋差额 2 开骰率 50%，差额 3 是 95%。形状相同，只是紧了一粒骰。' },
        ],
      },
      {
        heading: '为什么你的算术会骗你', range: '04 — 05',
        note: '这两条最可能改变你今晚的打法。',
        rules: [
          { title: '课本机率会让你太早开骰。', body: '万能差额 3 时，五粒未知骰凑出三粒的机率只有 21% — 照理说叫骰有 79% 是假的，开骰看似白赚。但求解器只开 43%。它接近无差异，代表真实为真的机率接近一半，而不是五分之一。' },
          { title: '因为叫骰的人不是随机的手牌。', body: '他选了那个点数。以「他确实叫了」为条件，真实机率会大幅上升 — 此例从 21% 升到约 50%。无论你从自己的骰算出什么数字，都要大幅往「叫骰为真」的方向修正。' },
        ],
      },
      {
        heading: '开叫', range: '06 — 10',
        note: '每两局你就先叫一次。这是唯一没有资讯、完全自由的一次叫骰。',
        rules: [
          { title: '标准开叫有两种，不是一种。', body: '66% 的开叫是「三个某点，万能」。另外 34% 是「两个某点，斋」。只会开万能，等于只用了三分之二的策略。' },
          { title: '大约每六次开叫诈一次。', body: '16.8% 的开叫落在自己完全没有的点数上。从不诈唬是可被针对的 — 对手知道你必有货，就能在边缘牌全数放掉、其余全开。' },
          { title: '两极化。要嘛很强，要嘛全空，不要中间。', body: '随机挑一个点数，你手上有三粒以上的机率是 16%；求解器却有 31% 开在这种点数上，接近两倍。相对地，它避开自己只有一两粒的点数。中庸的开叫最容易被加叫赶走。' },
          { title: '手上有万能一点时，别走斋。', body: '手上零到两粒一点时，求解器约 35% 开斋。有三粒以上一点时，骤降到 6–19%。斋会杀死你自己的一点 — 等于丢掉自己最好的骰。' },
          { title: '标准的价值开叫是两粒实点。', body: '35% 的开叫落在自己实际持有两粒的点数上。桌面两粒加上背后一两粒万能，就是最常见的「三个某点」，而且成立的机率远比看起来高。' },
        ],
      },
      {
        heading: '加叫', range: '11 — 15',
        note: '差额 3 以下，你要选的不是开不开，而是怎么加。',
        rules: [
          { title: '同数量换点与数量加一，两者都正常。', body: '在大部分叫骰阶段比例接近 50/50。只会加数量、或只会爬点数的人，等于放弃一半选项。' },
          { title: '叫骰后期，别再换点数。', body: '面对「六个」任何点数时，80% 的加叫只是把数量加一。爬到高处已经没有横向空间。' },
          { title: '加叫要加到自己有的点数上。', body: '89% 到 97% 的加叫落在自己至少有一粒的点数。中盘往前诈唬，远比开叫时少见。' },
          { title: '别照着对方给的点数复诵。', body: '面对「三个六」而自己只有零到三粒六点时，求解器只有 2–21% 继续叫六点。把叫骰拉到自己的点数上是常态，不是示弱。' },
          { title: '手上没货时，加叫，不要开骰。', body: '零符合面对「三个」时，求解器超过四分之一的加叫落在另一个同样没有的点数上。早期你打不过的叫骰通常是真的；往前诈唬胜过硬开。' },
        ],
      },
      {
        heading: '藏起大牌', range: '16 — 17',
        note: '整套求解中最反直觉的一段，也是对付懂基本功的人最有效的一招。',
        rules: [
          { title: '绝不要加叫自己的王牌点数。', body: '手握 66666 面对「三个六」，求解器只有 6% 会叫「四个六」。它改叫「三个一点斋」（34%）或「四个五」（30%）。加叫六点等于宣告你有六点，叫骰会在你赚不到的地方结束。' },
          { title: '当你的牌就是一点，就换成一点。', body: '手握 11666 面对「三个六」，求解器 91% 叫「三个一点斋」。一点位居点数顶端，对手不大幅跳数量就过不去 — 同时你的万能也不再被浪费。' },
        ],
      },
      {
        heading: '斋的经济学', range: '18 — 20',
        note: '斋不是对叫骰的小修正，它改变整局的算术。',
        rules: [
          { title: 'n 个斋，约等于 2n 个万能。', body: '一点不再计入，任一未知骰的符合机率从三分之一腰斩到六分之一。听到「三个五斋」，就当作对方说了「六个五」。' },
          { title: '斋局结束得很快。', body: '「四个」斋的开骰率是 95%，「四个」万能只有 36%。一旦有人走斋，这局大概一两次叫骰内就会结束 — 走之前先想好。' },
          { title: '过了七，没有东西活得下来。', body: '「七个」万能的开骰率是 97%，「七个」斋是 99%。十粒骰里叫到七，等于请人来开你。手上有货再叫，否则别碰。' },
        ],
      },
    ] as Section[],
  },
} as const;

function GapTable({ rows, tone, title, note, verdict, gapLabel }: {
  rows: { gap: string; pct: number }[]; tone: 'wild' | 'zhai';
  title: string; note: string; verdict: string; gapLabel: string;
}) {
  return (
    <div className={`gap-table ${tone}`}>
      <h3>{title}</h3>
      <p className="gap-note">{note}</p>
      <div className="gap-rows">
        {rows.map((row) => {
          const edge = row.pct > 20 && row.pct < 80;
          return (
            <div className="gap-row" key={row.gap}>
              <span className="gap-k">{gapLabel} {row.gap}</span>
              <span className="gap-track"><i style={{ width: `${row.pct}%` }} /></span>
              <span className={`gap-v ${edge ? 'edge' : ''}`}>{row.pct}%</span>
            </div>
          );
        })}
      </div>
      <p className="gap-verdict">{verdict}</p>
    </div>
  );
}

export function StrategySheet({ language }: { language: Language }) {
  const t = copy[language];
  // Rule numbers run 01..20 across sections, so each section starts after the ones before it.
  const offsets = t.sections.reduce<number[]>((acc, section, i) => (
    [...acc, i === 0 ? 0 : acc[i - 1] + t.sections[i - 1].rules.length]
  ), []);

  return (
    <section className="sheet-shell">
      <header className="sheet-intro">
        <p className="sheet-kicker">{t.kicker}</p>
        <h1 className="sheet-title">{t.title}</h1>
        <p className="sheet-lede">{t.lede}</p>
      </header>

      <div className="gap-hero">
        <p className="gap-lead">{t.heroLead}</p>
        <p className="gap-sub">{t.heroSub}</p>
        <div className="gap-tables">
          <GapTable rows={GAP_WILD} tone="wild" title={t.wild} note={t.wildNote} verdict={t.wildVerdict} gapLabel={t.gapLabel} />
          <GapTable rows={GAP_ZHAI} tone="zhai" title={t.zhai} note={t.zhaiNote} verdict={t.zhaiVerdict} gapLabel={t.gapLabel} />
        </div>
        <p className="gap-caption">{t.challengeRate}</p>
      </div>

      {t.sections.map((section, sectionIndex) => (
        <section className="sheet-sec" key={section.heading}>
          <div className="sheet-sec-head">
            <h2>{section.heading}</h2>
            <span>{section.range}</span>
          </div>
          <p className="sheet-sec-note">{section.note}</p>
          <ol className="sheet-rules">
            {section.rules.map((rule, ruleIndex) => (
              <li key={rule.title}>
                <span className="sheet-n">{String(offsets[sectionIndex] + ruleIndex + 1).padStart(2, '0')}</span>
                <div><b>{rule.title}</b><p>{rule.body}</p></div>
              </li>
            ))}
          </ol>
        </section>
      ))}

      <p className="sheet-foot">{t.footnote}</p>
    </section>
  );
}
