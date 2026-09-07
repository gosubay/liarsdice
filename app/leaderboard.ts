'use client';

// The high-score board. A run counts only when the player reaches WINS_TARGET wins in an
// Unlimited match, so every entry has the same numerator and the ranking is really a race
// to concede the fewest rounds.
//
// Storage is localStorage under `liarsdice.leaderboard`, one board shared by all three
// difficulties with each entry tagged. Nothing is ever sent anywhere — this is a board for
// one browser, not a global ladder.

import { useCallback, useSyncExternalStore } from 'react';

export const WINS_TARGET = 100;

export type BoardDifficulty = 'easy' | 'medium' | 'hard';

export type ScoreEntry = {
  id: string;
  name: string;
  wins: number;
  losses: number;
  difficulty: BoardDifficulty;
  /** ISO 8601, written at the moment the run finished. */
  date: string;
};

const KEY = 'liarsdice.leaderboard';
const SEEDED = 'liarsdice.leaderboard.seeded';

/** The board opens with one record on it so it never reads as broken on a first visit. */
const SEED: ScoreEntry[] = [
  { id: 'seed-galvin', name: 'Galvin', wins: 100, losses: 100, difficulty: 'medium', date: '2026-09-08T00:00:00+08:00' },
];

export function winRate(entry: ScoreEntry) {
  const played = entry.wins + entry.losses;
  return played === 0 ? 0 : entry.wins / played;
}

/** Fewest losses first, since every entry has the same win count. */
export function rankEntries(entries: ScoreEntry[]) {
  return [...entries].sort((a, b) => (
    winRate(b) - winRate(a)
    || a.losses - b.losses
    || Date.parse(a.date) - Date.parse(b.date)
  ));
}

/** `8/9/2026 00:00` — day first, the way Galvin writes dates. */
export function formatEntryDate(iso: string) {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${at.getDate()}/${at.getMonth() + 1}/${at.getFullYear()} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

function isEntry(value: unknown): value is ScoreEntry {
  const entry = value as Partial<ScoreEntry> | null;
  return Boolean(entry)
    && typeof entry?.id === 'string'
    && typeof entry.name === 'string'
    && typeof entry.wins === 'number'
    && typeof entry.losses === 'number'
    && typeof entry.date === 'string'
    && (entry.difficulty === 'easy' || entry.difficulty === 'medium' || entry.difficulty === 'hard');
}

const listeners = new Set<() => void>();
let snapshot: ScoreEntry[] | null = null;

function read(): ScoreEntry[] {
  if (typeof window === 'undefined') return SEED;
  try {
    const stored = window.localStorage.getItem(KEY);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed.filter(isEntry);
    }
    // Only seed once. A player who clears the board keeps it cleared.
    if (window.localStorage.getItem(SEEDED) === 'yes') return [];
    window.localStorage.setItem(SEEDED, 'yes');
    window.localStorage.setItem(KEY, JSON.stringify(SEED));
    return SEED;
  } catch {
    // private mode or blocked storage — the board still renders, it just cannot persist
    return SEED;
  }
}

function write(next: ScoreEntry[]) {
  snapshot = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
    window.localStorage.setItem(SEEDED, 'yes');
  } catch { /* storage blocked */ }
  listeners.forEach((fn) => fn());
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};
const getSnapshot = () => (snapshot ??= read());
const getServerSnapshot = () => SEED;

export function useLeaderboard() {
  const entries = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const add = useCallback((entry: Omit<ScoreEntry, 'id' | 'date'> & { date?: string }) => {
    const record: ScoreEntry = {
      ...entry,
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      date: entry.date ?? new Date().toISOString(),
    };
    write([...(snapshot ?? read()), record]);
    return record;
  }, []);

  return { entries, add };
}
