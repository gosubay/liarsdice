'use client';

// Full screen for phones and tablets. Two routes, because no single one covers both:
//
//   'api'     — the browser can hide its own bars on request (Android, iPad). The
//               header button toggles it.
//   'install' — iPhone Safari refuses that request for anything but video. The only
//               way to lose the bars there is Add to Home Screen, which launches the
//               game full screen via public/manifest.webmanifest and the apple-* tags.
//               The header button shows a one-line how-to instead.
//   'none'    — not a touch device, or already launched from the home screen. No button.

import { useCallback, useSyncExternalStore } from 'react';

type FsDocument = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
};
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => void };

export type FullscreenState = 'none' | 'install' | 'api-off' | 'api-on';

const EVENTS = ['fullscreenchange', 'webkitfullscreenchange'];

// Decided once per page load: entering full screen makes display-mode match
// 'fullscreen', which must not be mistaken for a home-screen launch.
let installed: boolean | null = null;

function launchedFromHomeScreen() {
  return (installed ??= window.matchMedia?.('(display-mode: standalone), (display-mode: fullscreen)').matches === true
    || (navigator as Navigator & { standalone?: boolean }).standalone === true);
}

function subscribe(fn: () => void) {
  EVENTS.forEach((name) => document.addEventListener(name, fn));
  return () => EVENTS.forEach((name) => document.removeEventListener(name, fn));
}

function getSnapshot(): FullscreenState {
  if (navigator.maxTouchPoints === 0 || launchedFromHomeScreen()) return 'none';
  const doc = document as FsDocument;
  if (!(doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled)) return 'install';
  return (doc.fullscreenElement ?? doc.webkitFullscreenElement) ? 'api-on' : 'api-off';
}

const getServerSnapshot = (): FullscreenState => 'none';

export function useFullscreen() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const toggle = useCallback(() => {
    const doc = document as FsDocument;
    const root = document.documentElement as FsElement;
    const leaving = Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement);
    // The standard calls return a promise, the webkit ones return nothing; either can
    // refuse, and a refusal should reach the console rather than vanish.
    const failed = (error: unknown) => console.warn(`[fullscreen] ${leaving ? 'exit' : 'enter'} refused`, error);
    try {
      const pending = leaving
        ? (doc.exitFullscreen ? doc.exitFullscreen() : doc.webkitExitFullscreen?.())
        : (root.requestFullscreen ? root.requestFullscreen({ navigationUI: 'hide' }) : root.webkitRequestFullscreen?.());
      Promise.resolve(pending).catch(failed);
    } catch (error) {
      failed(error);
    }
  }, []);
  return [state, toggle] as const;
}
