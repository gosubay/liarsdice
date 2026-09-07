'use client';

// Whether to play the dice-cup animation. Persisted per browser, so the choice
// survives a reload. Defaults to on, except under prefers-reduced-motion where a
// shaking cup is a motion-sickness trigger and the default is off.

import { useCallback, useSyncExternalStore } from 'react';

const KEY = 'liarsdice.animation';

export function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/** WebGL is required for the 3D roll; without it we fall back to the flat dice. */
export function hasWebGL() {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function read() {
  if (typeof window === 'undefined') return true;
  try {
    const stored = window.localStorage.getItem(KEY);
    if (stored === 'on') return true;
    if (stored === 'off') return false;
  } catch {
    // private mode or blocked storage — fall through to the motion preference
  }
  return !prefersReducedMotion();
}

const listeners = new Set<() => void>();
function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

let snapshot: boolean | null = null;
function getSnapshot() {
  snapshot ??= read();
  return snapshot;
}
/** On the server there is no storage and no media query, so assume on. */
function getServerSnapshot() {
  return true;
}

export function useAnimationPref() {
  const enabled = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const update = useCallback((next: boolean) => {
    snapshot = next;
    try { window.localStorage.setItem(KEY, next ? 'on' : 'off'); } catch { /* storage blocked */ }
    listeners.forEach((fn) => fn());
  }, []);

  return [enabled, update] as const;
}
