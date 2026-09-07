'use client';

// Player preferences that survive a reload: the dice-cup animation and its sound.
// Both live in localStorage under `liarsdice.*` and are read through
// useSyncExternalStore, so every toggle on the page stays in step.
//
// Animation defaults to on, except under prefers-reduced-motion where a shaking cup
// is a motion-sickness trigger. Sound defaults to on too, but it can only ever start
// after the player has pressed Start game, so nothing plays unprompted on page load.

import { useCallback, useSyncExternalStore } from 'react';

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

/** One stored on/off flag, shared by every component that reads it. */
function makePref(key: string, fallback: () => boolean) {
  const listeners = new Set<() => void>();
  let snapshot: boolean | null = null;

  const read = () => {
    if (typeof window === 'undefined') return true;
    try {
      const stored = window.localStorage.getItem(key);
      if (stored === 'on') return true;
      if (stored === 'off') return false;
    } catch {
      // private mode or blocked storage — fall through to the default
    }
    return fallback();
  };

  const subscribe = (fn: () => void) => {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  };
  const getSnapshot = () => (snapshot ??= read());
  /** On the server there is no storage and no media query, so assume on. */
  const getServerSnapshot = () => true;

  return function usePref() {
    const enabled = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    const update = useCallback((next: boolean) => {
      snapshot = next;
      try { window.localStorage.setItem(key, next ? 'on' : 'off'); } catch { /* storage blocked */ }
      listeners.forEach((fn) => fn());
    }, []);
    return [enabled, update] as const;
  };
}

export const useAnimationPref = makePref('liarsdice.animation', () => !prefersReducedMotion());
export const useSoundPref = makePref('liarsdice.sound', () => true);
