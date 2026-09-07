'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bot,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  Flag,
  Infinity as InfinityIcon,
  Languages,
  RotateCcw,
  Sparkles,
  Swords,
  Trophy,
  UserRound,
  X,
} from 'lucide-react';

import { Die } from './die';
import { MathPage } from './math';
import { RulesPage } from './rules';
import { SolverGrid } from './solver';
import { StrategySheet } from './strategy';

import { loadPolicy, samplePolicyMove, type Policy, type PolicyMove } from './policy';

type Language = 'en' | 'zh';
type MatchMode = 'five' | 'unlimited';
type Player = 'human' | 'ai';
type Difficulty = 'easy' | 'hard';
type Tab = 'play' | 'rules' | 'math' | 'strategy' | 'solver';
type Phase = 'playing' | 'revealed' | 'finished';
type Bid = { quantity: number; face: number; zhai: boolean };
type Result = { loser: Player; actual: number; bidder: Player; challenger: Player };

type WebMCPDocument = Document & {
  modelContext?: {
    registerTool: (
      tool: {
        name: string;
        title: string;
        description: string;
        inputSchema: object;
        execute: (input: unknown) => unknown;
        annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      },
      options: { signal: AbortSignal },
    ) => void | Promise<void>;
  };
};

const DIFFICULTIES: Difficulty[] = ['easy', 'hard'];
const TABS: Tab[] = ['play', 'rules', 'math', 'strategy', 'solver'];

// The opening bid must clear one of these floors. Later bids only have to beat the
// bid before them, so the floor never binds again. Mirrored in app/rules.tsx.
const MIN_OPENING = { wild: 3, zhai: 2, ones: 2 };

function openingFloorFor(face: number, zhai: boolean) {
  if (face === 1) return MIN_OPENING.ones;
  return zhai ? MIN_OPENING.zhai : MIN_OPENING.wild;
}

function meetsOpeningMinimum(bid: Bid) {
  return bid.quantity >= openingFloorFor(bid.face, bid.zhai);
}

const FACE_ORDER = [2, 3, 4, 5, 6, 1];
const rollFive = () => Array.from({ length: 5 }, () => Math.floor(Math.random() * 6) + 1);
const isStraight = (dice: number[]) => new Set(dice).size === 5;
const faceRank = (face: number) => FACE_ORDER.indexOf(face);

const copy = {
  en: {
    kicker: 'China KTV rules', title: "Liar's Dice", intro: 'Five dice. One rival. Read the room and call the bluff.',
    mode: 'Choose a match', five: 'First to 5 losses', fiveNote: 'A quick competitive match', unlimited: 'Unlimited', unlimitedNote: 'Keep the table rolling',
    opponent: 'You vs Basic AI', start: 'Take a seat', rulesLine: '1 is wild · Pure bids disable wilds · A straight may re-roll',
    you: 'You', ai: 'AI', losses: 'Losses', record: 'W–L', round: 'Round', turn: 'Your turn', aiTurn: 'AI is thinking', currentBid: 'Current bid', opening: 'Make the opening bid',
    quantity: 'Quantity', face: 'Face', zhai: 'Pure · Zhai', zhaiHelp: 'Wild ones do not count', bid: 'Place bid', challenge: 'Challenge',
    reroll: 'Re-roll straight', rerolled: 'Straight re-rolled', concealed: 'Hidden dice', noBid: 'No bid yet',
    challenged: 'Bid challenged', actual: 'matching dice', bidHeld: 'The bid holds.', bidFailed: 'The bid was a bluff.',
    youLose: 'You lose this round', aiLoses: 'AI loses this round', next: 'Next round', matchOver: 'Match over',
    youWin: 'You win the match', aiWins: 'AI wins the match', playAgain: 'Play again', leave: 'Leave table', reset: 'Restart match',
    invalid: 'Raise the current bid to continue.', feiRequired: 'To break zhai, call at least double the quantity.',
    fei: 'Fei · 飞', normal: 'Wild', rulesTitle: 'Table rules', close: 'Close',
    rules: ['Each player always rolls five dice.', 'On a normal bid, ones are wild.', 'Bids rank 1 › 6 › 5 › 4 › 3 › 2.', 'A bid on ones is automatically zhai.', 'In zhai, wild ones do not count.', 'Break zhai with at least double the quantity.', 'Five different faces may be re-rolled once.', 'The round loser gains one loss.'],
    starter: 'Round loser starts', setup: 'Match setup', menu: 'Rules',
    tabPlay: 'Play', tabRules: 'Rules', tabMath: 'Math', tabStrategy: 'GTO Strategy', tabSolver: 'Solver',
    openingFloor: 'Open with at least 3 wild, 2 zhai, or 2 ones.',
    difficulty: 'Bot difficulty', startGame: 'Start game', opponentWith: (level: string) => `You vs ${level} AI`,
    easy: 'Easy', easyNote: 'Bids almost at random and challenges on a whim',
    hard: 'Hard', hardNote: 'Plays the CFR-solved strategy from the GTO tab',
    solverFallback: 'off-book',
    solverFallbackHelp: 'The solve does not cover this bid, so the bot fell back to basic play.',
  },
  zh: {
    kicker: '中国 KTV 酒桌规则', title: '大话骰', intro: '五粒骰，一个对手。看穿虚实，开出胜负。',
    mode: '选择局制', five: '先负 5 局', fiveNote: '节奏明快的对局', unlimited: '无限局', unlimitedNote: '想玩多久都可以',
    opponent: '你 对 基础电脑', start: '入座开局', rulesLine: '一点万能 · 斋叫不计万能 · 顺子可以重摇',
    you: '你', ai: '电脑', losses: '负局', record: '胜–负', round: '第', turn: '轮到你', aiTurn: '电脑思考中', currentBid: '当前叫骰', opening: '请先叫骰',
    quantity: '数量', face: '点数', zhai: '斋', zhaiHelp: '一点不作万能', bid: '叫骰', challenge: '开',
    reroll: '顺子重摇', rerolled: '顺子已重摇', concealed: '骰子未开', noBid: '尚未叫骰',
    challenged: '开骰', actual: '粒符合', bidHeld: '叫骰成立。', bidFailed: '叫骰不成立。',
    youLose: '你输掉本局', aiLoses: '电脑输掉本局', next: '下一局', matchOver: '比赛结束',
    youWin: '你赢得比赛', aiWins: '电脑赢得比赛', playAgain: '再玩一次', leave: '离开桌面', reset: '重新开始',
    invalid: '必须提高当前叫骰。', feiRequired: '破斋需要至少叫双倍数量。',
    fei: '飞', normal: '万能', rulesTitle: '桌面规则', close: '关闭',
    rules: ['每位玩家始终摇五粒骰。', '普通叫骰时，一点可作万能。', '点数顺序为 1 › 6 › 5 › 4 › 3 › 2。', '叫一点自动视为斋。', '斋叫时，一点不作万能。', '破斋必须至少叫双倍数量。', '五个不同点数可选择重摇一次。', '每局输家增加一负。'],
    starter: '输家下一局先叫', setup: '比赛设置', menu: '规则',
    tabPlay: '对局', tabRules: '规则', tabMath: '算术', tabStrategy: 'GTO 策略', tabSolver: '求解器',
    openingFloor: '开叫至少要三个万能、两个斋，或两个一点。',
    difficulty: '电脑难度', startGame: '开始对局', opponentWith: (level: string) => `你 对 ${level}电脑`,
    easy: '简单', easyNote: '几乎随机叫骰，随兴开骰',
    hard: '困难', hardNote: '使用 GTO 页面里的 CFR 求解策略',
    solverFallback: '超出求解',
    solverFallbackHelp: '此叫骰不在求解范围内，电脑改用基础打法。',
  },
} as const;

function bidIsLegal(next: Bid, current: Bid | null) {
  if (next.quantity < 1 || next.quantity > 10) return false;
  if (!current) return meetsOpeningMinimum(next);
  if (current.zhai && !next.zhai) return next.quantity >= current.quantity * 2;
  return next.quantity > current.quantity || (next.quantity === current.quantity && faceRank(next.face) > faceRank(current.face));
}

export default function Home() {
  const [language, setLanguage] = useState<Language>('en');
  const [mode, setMode] = useState<MatchMode>('five');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [wentOffBook, setWentOffBook] = useState(false);
  const [screen, setScreen] = useState<'setup' | 'game'>('setup');
  const [tab, setTab] = useState<Tab>('play');
  const [showRules, setShowRules] = useState(false);
  const [round, setRound] = useState(1);
  const [losses, setLosses] = useState({ human: 0, ai: 0 });
  const [humanDice, setHumanDice] = useState<number[]>([]);
  const [aiDice, setAiDice] = useState<number[]>([]);
  const [turn, setTurn] = useState<Player>('human');
  const [starter, setStarter] = useState<Player>('human');
  const [phase, setPhase] = useState<Phase>('playing');
  const [currentBid, setCurrentBid] = useState<Bid | null>(null);
  const [draft, setDraft] = useState<Bid>({ quantity: 3, face: 2, zhai: false });
  const [result, setResult] = useState<Result | null>(null);
  const [didReroll, setDidReroll] = useState(false);
  const [notice, setNotice] = useState('');
  const t = copy[language];

  useEffect(() => {
    if (difficulty !== 'hard' || policy) return;
    let live = true;
    loadPolicy().then((data) => { if (live) setPolicy(data); }).catch(() => undefined);
    return () => { live = false; };
  }, [difficulty, policy]);

  const startRound = useCallback((roundStarter: Player, roundNumber?: number) => {
    const nextHuman = rollFive();
    let nextAi = rollFive();
    if (isStraight(nextAi) && Math.random() > 0.35) nextAi = rollFive();
    setHumanDice(nextHuman);
    setAiDice(nextAi);
    setTurn(roundStarter);
    setStarter(roundStarter);
    setCurrentBid(null);
    setDraft({ quantity: 3, face: 2, zhai: false });
    setResult(null);
    setPhase('playing');
    setDidReroll(false);
    setWentOffBook(false);
    setNotice('');
    if (roundNumber) setRound(roundNumber);
  }, []);

  const startMatch = useCallback((chosenMode: MatchMode = mode) => {
    setMode(chosenMode);
    setLosses({ human: 0, ai: 0 });
    setRound(1);
    setScreen('game');
    startRound('human', 1);
  }, [mode, startRound]);

  const normalizedDraft = useMemo(() => ({ ...draft, zhai: draft.face === 1 ? true : draft.zhai }), [draft]);
  // With no bid on the table the opening floor applies, so the stepper stops there
  // rather than letting the player build a bid the rules will reject.
  const minQuantity = currentBid ? 1 : openingFloorFor(normalizedDraft.face, normalizedDraft.zhai);
  const legalDraft = bidIsLegal(normalizedDraft, currentBid);
  const isFei = Boolean(currentBid?.zhai && !normalizedDraft.zhai && legalDraft);

  const placeBid = useCallback((bid: Bid, bidder: Player) => {
    if (!bidIsLegal(bid, currentBid)) return false;
    setCurrentBid(bid);
    setDraft({ quantity: Math.min(10, bid.quantity), face: bid.face, zhai: bid.face === 1 ? true : bid.zhai });
    setTurn(bidder === 'human' ? 'ai' : 'human');
    setNotice('');
    return true;
  }, [currentBid]);

  const challenge = useCallback((challenger: Player) => {
    if (!currentBid) return;
    const allDice = [...humanDice, ...aiDice];
    const actual = allDice.filter((die) => die === currentBid.face || (!currentBid.zhai && die === 1)).length;
    const bidder: Player = challenger === 'human' ? 'ai' : 'human';
    const loser: Player = actual >= currentBid.quantity ? challenger : bidder;
    const nextLosses = { ...losses, [loser]: losses[loser] + 1 };
    setLosses(nextLosses);
    setResult({ loser, actual, bidder, challenger });
    setPhase(mode === 'five' && nextLosses[loser] >= 5 ? 'finished' : 'revealed');
    setStarter(loser);
  }, [aiDice, currentBid, humanDice, losses, mode]);

  // Easy: near-random legal play. This is the original V1 bot, kept as the floor.
  const easyMove = useCallback((): PolicyMove => {
    if (currentBid && (currentBid.quantity >= 8 || Math.random() < 0.18)) return { kind: 'challenge' };
    const candidates: Bid[] = [];
    for (let quantity = 1; quantity <= 10; quantity++) {
      for (const face of FACE_ORDER) {
        const pureOptions = face === 1 ? [true] : [false, true];
        for (const zhai of pureOptions) {
          const candidate = { quantity, face, zhai };
          if (bidIsLegal(candidate, currentBid)) candidates.push(candidate);
        }
      }
    }
    const shortlist = candidates.slice(0, Math.min(7, candidates.length));
    const choice = shortlist[Math.floor(Math.random() * shortlist.length)];
    return choice ? { kind: 'bid', bid: choice } : { kind: 'challenge' };
  }, [currentBid]);

  useEffect(() => {
    if (screen !== 'game' || phase !== 'playing' || turn !== 'ai') return;
    const timer = window.setTimeout(() => {
      let move: PolicyMove | null = null;

      if (difficulty === 'hard' && policy) {
        move = samplePolicyMove(policy, aiDice, currentBid, (candidate) => (
          candidate.kind === 'challenge' ? Boolean(currentBid) : bidIsLegal(candidate.bid, currentBid)
        ));
        // Quantities above seven, and the zhai/fei transitions the export omits, land
        // outside the solve. Drop to the easy bot rather than invent a move.
        if (!move) setWentOffBook(true);
      }

      const chosen = move ?? easyMove();
      if (chosen.kind === 'bid') placeBid(chosen.bid, 'ai');
      else if (currentBid) challenge('ai');
    }, 720);
    return () => window.clearTimeout(timer);
  }, [aiDice, challenge, currentBid, difficulty, easyMove, phase, placeBid, policy, screen, turn]);

  useEffect(() => {
    const context = (document as WebMCPDocument).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const registration = context.registerTool({
      name: 'start_liars_dice_match',
      title: "Start a Liar's Dice match",
      description: 'Start a new one-human-versus-AI match in either first-to-five-losses or unlimited mode.',
      inputSchema: { type: 'object', properties: { mode: { type: 'string', enum: ['five', 'unlimited'] }, language: { type: 'string', enum: ['en', 'zh'] } }, required: ['mode'], additionalProperties: false },
      execute(input) {
        const value = input as { mode?: MatchMode; language?: Language };
        if (value.mode !== 'five' && value.mode !== 'unlimited') throw new Error('Mode must be five or unlimited.');
        if (value.language) setLanguage(value.language);
        startMatch(value.mode);
        return { status: 'started', mode: value.mode, opponent: 'basic-ai' };
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
    }, { signal: lifecycle.signal });
    void Promise.resolve(registration).catch(() => undefined);
    return () => lifecycle.abort();
  }, [startMatch]);

  const submitHumanBid = () => {
    if (!legalDraft) {
      setNotice(!currentBid ? t.openingFloor : currentBid.zhai && !normalizedDraft.zhai ? t.feiRequired : t.invalid);
      return;
    }
    placeBid(normalizedDraft, 'human');
  };

  const changeFace = (face: number) => setDraft((value) => {
    const zhai = face === 1 ? true : value.zhai;
    const floor = currentBid ? 1 : openingFloorFor(face, zhai);
    return { face, zhai, quantity: Math.max(value.quantity, floor) };
  });

  const toggleZhai = () => setDraft((value) => {
    const zhai = !value.zhai;
    const floor = currentBid ? 1 : openingFloorFor(value.face, zhai);
    return { ...value, zhai, quantity: Math.max(value.quantity, floor) };
  });
  const nextRound = () => startRound(starter, round + 1);
  const swapLanguage = () => setLanguage(language === 'en' ? 'zh' : 'en');

  return (
    <main className={`min-h-screen bg-background text-foreground ${tab === 'play' ? 'overflow-hidden' : ''}`}>
      <div className="table-glow" aria-hidden="true" />
      <header className="site-header">
        <button className="brand" onClick={() => { setTab('play'); setScreen('setup'); }} aria-label={language === 'en' ? 'Return to setup' : '返回设置'}>
          <span className="logo-die" aria-hidden="true"><i /><i /><i /></span>
          <span>LIARSDICE</span>
        </button>
        <nav className="tab-nav" aria-label={t.setup}>
          {TABS.map((name) => (
            <button
              key={name}
              className={tab === name ? 'selected' : ''}
              aria-pressed={tab === name}
              onClick={() => setTab(name)}
            >
              {{ play: t.tabPlay, rules: t.tabRules, math: t.tabMath, strategy: t.tabStrategy, solver: t.tabSolver }[name]}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          {tab === 'play' && screen === 'game' && <button className="icon-button" onClick={() => setShowRules(true)}><CircleHelp size={17} /><span>{t.menu}</span></button>}
          <button className="language-button" onClick={swapLanguage} aria-label={language === 'en' ? 'Switch to Chinese' : '切换到英文'}><Languages size={16} />{language === 'en' ? '中文' : 'EN'}</button>
        </div>
      </header>

      {tab === 'solver' ? (
        <SolverGrid language={language} />
      ) : tab === 'strategy' ? (
        <StrategySheet language={language} />
      ) : tab === 'math' ? (
        <MathPage language={language} />
      ) : tab === 'rules' ? (
        <RulesPage language={language} />
      ) : screen === 'setup' ? (
        <section className="setup-layout">
          <div className="max-w-xl">
            <p className="eyebrow">{t.kicker}</p>
            <h1 className="display-title">{t.title}</h1>
            <p className="intro-copy">{t.intro}</p>
            <div className="opponent-line"><Bot size={18} /> <span>{t.opponentWith(difficulty === 'easy' ? t.easy : t.hard)}</span></div>
          </div>
          <div className="setup-card">
            <div className="card-heading"><p>{t.mode}</p><span className="round-pill">V1</span></div>
            <div className="grid gap-3">
              <button className={`mode-card ${mode === 'five' ? 'selected' : ''}`} onClick={() => setMode('five')}>
                <span className="mode-icon"><Trophy size={19} /></span><span className="text-left"><b>{t.five}</b><small>{t.fiveNote}</small></span><span className="radio-dot" />
              </button>
              <button className={`mode-card ${mode === 'unlimited' ? 'selected' : ''}`} onClick={() => setMode('unlimited')}>
                <span className="mode-icon"><InfinityIcon size={20} /></span><span className="text-left"><b>{t.unlimited}</b><small>{t.unlimitedNote}</small></span><span className="radio-dot" />
              </button>
            </div>
            <div className="card-heading difficulty-heading"><p>{t.difficulty}</p></div>
            <div className="difficulty-row">
              {DIFFICULTIES.map((level) => (
                <button
                  key={level}
                  className={`difficulty-card ${difficulty === level ? 'selected' : ''}`}
                  aria-pressed={difficulty === level}
                  onClick={() => setDifficulty(level)}
                >
                  <span className="difficulty-rank">{level === 'easy' ? '1' : '2'}</span>
                  <span className="text-left"><b>{level === 'easy' ? t.easy : t.hard}</b><small>{level === 'easy' ? t.easyNote : t.hardNote}</small></span>
                  <span className="radio-dot" />
                </button>
              ))}
            </div>
            <button className="primary-button mt-5" onClick={() => startMatch()}>{t.startGame}<span>→</span></button>
            <p className="fine-print">{t.rulesLine}</p>
          </div>
        </section>
      ) : (
        <section className="game-shell">
          <div className="game-topbar">
            <div><span>{t.round}</span><b>{round}</b></div>
            <span className={`turn-indicator ${turn === 'ai' ? 'thinking' : ''}`}><i />{phase === 'playing' ? (turn === 'human' ? t.turn : t.aiTurn) : t.challenged}</span>
            <button className="quiet-button" onClick={() => startMatch(mode)}><RotateCcw size={15} />{t.reset}</button>
          </div>

          <div className="players-row">
            <article className={`player-card ${turn === 'human' && phase === 'playing' ? 'active' : ''}`}>
              <div className="player-meta"><span className="avatar human"><UserRound size={19} /></span><div><b>{t.you}</b><small>{starter === 'human' ? t.starter : ' '}</small></div><span className="score-record" aria-label={`${t.you} ${t.record}: ${losses.ai}–${losses.human}`}><small>{t.record}</small><em>{losses.ai}<i>–</i>{losses.human}</em></span></div>
              <div className="dice-row">{humanDice.map((die, i) => <Die key={`${round}-h-${i}`} value={die} accent={die === 1} />)}</div>
              {phase === 'playing' && isStraight(humanDice) && !didReroll && (
                <button className="reroll-button" onClick={() => { setHumanDice(rollFive()); setDidReroll(true); setNotice(t.rerolled); }}><Sparkles size={15} />{t.reroll}</button>
              )}
            </article>

            <article className={`player-card ${turn === 'ai' && phase === 'playing' ? 'active' : ''}`}>
              <div className="player-meta"><span className="avatar ai"><Bot size={19} /></span><div><b>{t.ai}<em className={`difficulty-tag ${difficulty}`}><Swords size={11} />{difficulty === 'easy' ? t.easy : t.hard}</em>{wentOffBook && <em className="difficulty-tag offbook" title={t.solverFallbackHelp}>{t.solverFallback}</em>}</b><small>{starter === 'ai' ? t.starter : ' '}</small></div><span className="score-record" aria-label={`${t.ai} ${t.record}: ${losses.human}–${losses.ai}`}><small>{t.record}</small><em>{losses.human}<i>–</i>{losses.ai}</em></span></div>
              <div className="dice-row">{aiDice.map((die, i) => <Die key={`${round}-a-${i}`} value={phase === 'playing' ? undefined : die} hidden={phase === 'playing'} accent={phase !== 'playing' && die === 1} />)}</div>
            </article>
          </div>

          <div className="bid-stage">
            <div className="current-bid-panel">
              <p>{currentBid ? t.currentBid : t.opening}</p>
              {currentBid ? <div className="bid-readout"><strong>{currentBid.quantity}</strong><span>×</span><Die value={currentBid.face} accent={currentBid.face === 1} /><div><b>{currentBid.zhai ? t.zhai : t.normal}</b>{currentBid.zhai && <small>{t.zhaiHelp}</small>}</div></div> : <div className="empty-bid"><span>—</span><small>{t.noBid}</small></div>}
            </div>

            {phase === 'playing' ? (
              <div className={`bid-controls ${turn === 'ai' ? 'disabled' : ''}`} aria-disabled={turn === 'ai'}>
                <div className="control-labels"><span>{t.quantity}</span><span>{t.face}</span></div>
                <div className="bid-builder">
                  <div className="stepper"><button onClick={() => setDraft((v) => ({ ...v, quantity: Math.max(minQuantity, v.quantity - 1) }))} disabled={turn === 'ai' || draft.quantity <= minQuantity}><ChevronDown /></button><strong>{draft.quantity}</strong><button onClick={() => setDraft((v) => ({ ...v, quantity: Math.min(10, v.quantity + 1) }))} disabled={turn === 'ai'}><ChevronUp /></button></div>
                  <div className="face-picker">{FACE_ORDER.map((face) => <button key={face} className={draft.face === face ? 'selected' : ''} onClick={() => changeFace(face)} disabled={turn === 'ai'}>{face}</button>)}</div>
                </div>
                <div className="zhai-row">
                  <button className={`zhai-toggle ${normalizedDraft.zhai ? 'selected' : ''}`} disabled={draft.face === 1 || turn === 'ai'} onClick={toggleZhai}><span className="toggle-track"><i /></span><b>{t.zhai}</b><small>{t.zhaiHelp}</small></button>
                  {isFei && <span className="fei-badge">{t.fei}</span>}
                </div>
                {!currentBid && !notice && <p className="notice floor-hint">{t.openingFloor}</p>}
                {notice && <p className="notice" role="alert">{notice}</p>}
                <div className="action-row">
                  <button className="challenge-button" disabled={!currentBid || turn === 'ai'} onClick={() => challenge('human')}><Flag size={17} />{t.challenge}</button>
                  <button className="primary-button" disabled={turn === 'ai' || !legalDraft} onClick={submitHumanBid}>{t.bid}<span>→</span></button>
                </div>
              </div>
            ) : result ? (
              <div className="result-panel">
                <div className={`result-mark ${result.loser === 'human' ? 'loss' : 'win'}`}>{result.loser === 'human' ? '×' : '✓'}</div>
                <div><p>{result.loser === 'human' ? t.youLose : t.aiLoses}</p><h2>{result.actual} {t.actual}</h2><small>{result.actual >= (currentBid?.quantity ?? 0) ? t.bidHeld : t.bidFailed}</small></div>
                <button className="primary-button" onClick={phase === 'finished' ? () => startMatch(mode) : nextRound}>{phase === 'finished' ? t.playAgain : t.next}<span>→</span></button>
                {phase === 'finished' && <p className="match-result"><Trophy size={15} />{result.loser === 'human' ? t.aiWins : t.youWin}</p>}
              </div>
            ) : null}
          </div>
        </section>
      )}

      {showRules && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowRules(false)}>
          <section className="rules-modal" role="dialog" aria-modal="true" aria-labelledby="rules-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-heading"><div><p>{t.kicker}</p><h2 id="rules-title">{t.rulesTitle}</h2></div><button onClick={() => setShowRules(false)} aria-label={t.close}><X /></button></div>
            <ol>{t.rules.map((rule, i) => <li key={rule}><span>{i + 1}</span>{rule}</li>)}</ol>
            <button className="primary-button" onClick={() => setShowRules(false)}>{t.close}</button>
          </section>
        </div>
      )}
    </main>
  );
}
