'use client';

// The Leaderboard tab. One sub-tab per difficulty, because a 100-win run against Easy
// and one against Hard are not the same achievement and should never share a table.

import { useState } from 'react';
import { Crown, Infinity as InfinityIcon, Trophy } from 'lucide-react';

import {
  WINS_TARGET,
  formatEntryDate,
  rankEntries,
  useLeaderboard,
  winRate,
  type BoardDifficulty,
} from './leaderboard';

type Language = 'en' | 'zh';

const BOARDS: BoardDifficulty[] = ['easy', 'medium', 'hard'];

const copy = {
  en: {
    kicker: 'Hall of records · this browser only',
    title: 'Leaderboard',
    lede: `Play an Unlimited match and win ${WINS_TARGET} rounds, and you are invited to put your name on the board. Your losses come along with it, so the board is really a race to give away as few rounds as possible on the way to ${WINS_TARGET}.`,
    easy: 'Easy', medium: 'Medium', hard: 'Hard',
    rank: '#', name: 'Name', score: 'Score', rate: 'Win rate', date: 'Date',
    emptyTitle: 'No records yet',
    emptyBody: (level: string) => `Nobody has reached ${WINS_TARGET} wins against ${level} yet. Start an Unlimited match to be the first.`,
    howHead: 'How to get on the board',
    how: [
      'Pick Unlimited on the setup card, and pick your bot.',
      `Play until you have won ${WINS_TARGET} rounds. The match does not stop you before then.`,
      'Enter your name when you are asked, and the run is saved with its date.',
    ],
    foot: 'Records live in this browser only. Clearing your site data clears the board, and it is never uploaded anywhere.',
  },
  zh: {
    kicker: '纪录榜 · 仅存于本浏览器',
    title: '排行榜',
    lede: `在「无限局」中赢满 ${WINS_TARGET} 局，就可以把名字留在榜上。负局数会一并记录，所以真正比的是——在赢到 ${WINS_TARGET} 局的路上，你送出了多少局。`,
    easy: '简单', medium: '中等', hard: '困难',
    rank: '#', name: '名字', score: '战绩', rate: '胜率', date: '日期',
    emptyTitle: '暂无纪录',
    emptyBody: (level: string) => `还没有人在${level}难度下赢满 ${WINS_TARGET} 局。开一局「无限局」，成为第一个。`,
    howHead: '如何上榜',
    how: [
      '在设置页选择「无限局」，并挑选电脑难度。',
      `一直玩到赢满 ${WINS_TARGET} 局，中途不会被打断。`,
      '在提示时输入名字，该场纪录连同日期一起保存。',
    ],
    foot: '纪录只保存在本浏览器。清除网站数据即会清空，且不会上传到任何地方。',
  },
} as const;

export function LeaderboardPage({ language }: { language: Language }) {
  const t = copy[language];
  const { entries } = useLeaderboard();
  const [board, setBoard] = useState<BoardDifficulty>('medium');

  const rows = rankEntries(entries.filter((entry) => entry.difficulty === board));

  return (
    <section className="board-shell">
      <div className="sheet-intro">
        <p className="sheet-kicker">{t.kicker}</p>
        <h1 className="sheet-title">{t.title}</h1>
        <p className="sheet-lede">{t.lede}</p>
      </div>

      <div className="board-tabs" role="tablist" aria-label={t.title}>
        {BOARDS.map((level) => (
          <button
            key={level}
            role="tab"
            aria-selected={board === level}
            className={`board-tab ${level} ${board === level ? 'selected' : ''}`}
            onClick={() => setBoard(level)}
          >
            <span className="board-tab-rank">{level === 'easy' ? '1' : level === 'medium' ? '2' : '3'}</span>
            {t[level]}
            <em>{entries.filter((entry) => entry.difficulty === level).length}</em>
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="board-empty">
          <Trophy size={26} />
          <b>{t.emptyTitle}</b>
          <p>{t.emptyBody(t[board])}</p>
        </div>
      ) : (
        <div className="board-table-wrap">
          <table className="board-table">
            <thead>
              <tr>
                <th scope="col" className="col-rank">{t.rank}</th>
                <th scope="col">{t.name}</th>
                <th scope="col" className="col-num">{t.score}</th>
                <th scope="col" className="col-num">{t.rate}</th>
                <th scope="col" className="col-date">{t.date}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((entry, index) => (
                <tr key={entry.id} className={index === 0 ? 'leader' : ''}>
                  <td className="col-rank">{index === 0 ? <Crown size={15} aria-label="1" /> : index + 1}</td>
                  <td className="board-name">{entry.name}</td>
                  <td className="col-num board-score">{entry.wins}<i>–</i>{entry.losses}</td>
                  <td className="col-num">{(winRate(entry) * 100).toFixed(1)}%</td>
                  <td className="col-date">{formatEntryDate(entry.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="board-how">
        <h2><InfinityIcon size={17} />{t.howHead}</h2>
        <ol>{t.how.map((step) => <li key={step}>{step}</li>)}</ol>
      </div>

      <p className="sheet-foot">{t.foot}</p>
    </section>
  );
}
