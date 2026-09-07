'use client';

// The dice cup: rattle, lift, tumble. Used for both players — yours opens as soon as
// the round starts, the AI's stays down until someone calls.
//
// Timings are fixed by TIMING below and must add up to ROLL_MS. Spec: DICE_ANIMATION.md.
// The dice values are decided before any of this runs, so the animation only ever
// rotates each cube to a face that is already known. It cannot change the result.

import { useEffect, useRef, useState } from 'react';
import { ShieldQuestion } from 'lucide-react';

export const TIMING = {
  /** Cup rattling on the table, dice hidden inside. */
  shake: 650,
  /** Cup lifting away. Starts as the rattle ends. */
  lift: 220,
  /** One die rotating to its face. */
  tumble: 300,
  /** Gap between each die starting its tumble. */
  stagger: 60,
};
/** Total wall time from round start to settled dice: 650 + 220 + 4*60 + 300 = 1410ms. */
export const ROLL_MS = TIMING.shake + TIMING.lift + TIMING.stagger * 4 + TIMING.tumble;

type Phase = 'shaking' | 'opening' | 'settled';

// Faces are placed so opposite sides sum to seven: 1 front, 6 back, 3 right, 4 left,
// 2 top, 5 bottom. To show a face, rotate the cube by the inverse of where it sits.
const FACE_PLACEMENT: Record<number, string> = {
  1: 'rotateY(0deg)',
  6: 'rotateY(180deg)',
  3: 'rotateY(90deg)',
  4: 'rotateY(-90deg)',
  2: 'rotateX(90deg)',
  5: 'rotateX(-90deg)',
};
const SHOW_FACE: Record<number, [number, number]> = {
  1: [0, 0], 6: [0, 180], 3: [0, -90], 4: [0, 90], 2: [-90, 0], 5: [90, 0],
};

function Pips({ value }: { value: number }) {
  return (
    <span className={`pip-face face-${value}`}>
      {Array.from({ length: value }, (_, i) => <i key={i} />)}
    </span>
  );
}

function Cube({ value, index, animate, label }: { value: number; index: number; animate: boolean; label: string }) {
  const [x, y] = SHOW_FACE[value] ?? [0, 0];
  // A couple of whole turns on the way, so it reads as a tumble rather than a flip.
  const spin = animate ? `rotateX(${x - 360}deg) rotateY(${y + 360}deg)` : `rotateX(${x}deg) rotateY(${y}deg)`;
  return (
    <span className={`cube-die ${value === 1 ? 'is-one' : ''}`} role="img" aria-label={label} data-value={value}>
      <span
        className={`cube ${animate ? 'tumbling' : ''}`}
        style={{
          transform: `rotateX(${x}deg) rotateY(${y}deg)`,
          ...(animate
            ? {
              animationDuration: `${TIMING.tumble}ms`,
              animationDelay: `${TIMING.shake + TIMING.lift + index * TIMING.stagger}ms`,
              // custom properties consumed by the die-tumble keyframes
              '--from': spin,
              '--to': `rotateX(${x}deg) rotateY(${y}deg)`,
            }
            : {}),
        }}
      >
        {[1, 2, 3, 4, 5, 6].map((face) => (
          <span className={`cube-face f${face}`} key={face} style={{ transform: `${FACE_PLACEMENT[face]} translateZ(var(--half))` }}>
            <Pips value={face} />
          </span>
        ))}
      </span>
    </span>
  );
}

/**
 * Give this a `key` that changes each round — remounting is what restarts the
 * animation, so the effect only ever schedules timers and never sets state on the
 * way in.
 */
export function DiceTray({
  dice, concealed, animate = true, hiddenLabel, skipLabel, dieLabel,
}: {
  dice: number[];
  /** Keep the cup down — used for the AI until someone calls. */
  concealed: boolean;
  animate?: boolean;
  hiddenLabel: string;
  skipLabel: string;
  dieLabel: string;
}) {
  const [phase, setPhase] = useState<Phase>(animate ? 'shaking' : 'settled');
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (!animate) return;
    const handles = [
      window.setTimeout(() => setPhase('opening'), TIMING.shake),
      window.setTimeout(() => setPhase('settled'), ROLL_MS),
    ];
    timers.current = handles;
    return () => { handles.forEach(window.clearTimeout); timers.current = []; };
  }, [animate]);

  const skip = () => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    setPhase('settled');
  };

  // The cup stays down over the AI's dice regardless of where the animation is.
  if (concealed) {
    return (
      <div className="dice-row">
        <div className={`cup closed ${phase === 'shaking' ? 'rattling' : ''}`} aria-label={hiddenLabel}>
          <span className="cup-body" />
          <span className="cup-lip" />
          <ShieldQuestion size={22} />
        </div>
      </div>
    );
  }

  return (
    <div className={`dice-row tray ${phase}`}>
      {dice.map((die, i) => (
        <Cube key={i} value={die} index={i} animate={animate && phase !== 'settled'} label={`${dieLabel} ${die}`} />
      ))}
      {phase !== 'settled' && (
        <>
          <div className="cup lifting" aria-hidden="true">
            <span className="cup-body" />
            <span className="cup-lip" />
          </div>
          <button type="button" className="tray-skip" onClick={skip}>{skipLabel}</button>
        </>
      )}
    </div>
  );
}
