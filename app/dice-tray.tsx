'use client';

// The dice cup. With animation on and WebGL available you get the 3D roll from
// roll-3d.ts: the cup rattles seen side-on, lifts away, and the camera swings
// overhead to leave five dice in a quincunx. The canvas then cross-fades into the
// flat CSS dice, which are what the rest of the round reads from — so three.js is
// only alive for the two seconds of the roll.
//
// Timings live in app/roll-timing.ts. Spec: DICE_ANIMATION.md.
// The dice values are decided before any of this runs, so the animation only ever
// shows a face that is already known. It cannot change the result.

import { useEffect, useRef, useState } from 'react';
import { ShieldQuestion } from 'lucide-react';
import { Die } from './die';
import { hasWebGL } from './animation-pref';
import { BEATS, ROLL_3D_MS } from './roll-timing';

export { ROLL_3D_MS as ROLL_MS };

/** How long the canvas takes to hand over to the flat dice. */
const CROSSFADE_MS = 160;

type Handle = { cancel: () => void; finish: () => void; step: (t: number) => void };

/**
 * Give this a `key` that changes each round — remounting is what restarts the
 * animation, so the effect only ever starts the roll and never sets state on the
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
  const diceKey = dice.join('');
  // WebGL support is fixed for the session; probing it once keeps `rolling` derivable,
  // so nothing has to write state on the way in.
  const [webgl] = useState(hasWebGL);
  const rolling = animate && !concealed && webgl && dice.length > 0;
  const [settled, setSettled] = useState(!rolling);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handle = useRef<Handle | null>(null);

  useEffect(() => {
    if (!rolling) return;
    let live = true;
    const canvas = canvasRef.current;
    if (!canvas) return;

    import('./roll-3d')
      .then(({ playRoll }) => {
        if (!live) return;
        // The scene is framed from the element's real box, so the cup is never
        // stretched by a buffer that disagrees with the CSS size.
        handle.current = playRoll({
          canvas,
          dice: diceKey.split('').map(Number),
          width: canvas.clientWidth || 260,
          height: canvas.clientHeight || 220,
          onSettled: () => setSettled(true),
        });
        // Debug seam: lets the beats be stepped through by hand from the console.
        (canvas as HTMLCanvasElement & { roll?: Handle }).roll = handle.current;
      })
      .catch(() => { if (live) setSettled(true); });

    return () => {
      live = false;
      handle.current?.cancel();
      handle.current = null;
    };
  }, [diceKey, rolling]);

  const skip = () => {
    handle.current?.finish();
    handle.current = null;
    setSettled(true);
  };

  // The cup stays down over the AI's dice regardless of where the animation is.
  if (concealed) {
    return (
      <div className="dice-quincunx concealed">
        <div className={`cup-flat ${animate ? 'rattling' : ''}`} aria-label={hiddenLabel}>
          <span className="cup-body" />
          <span className="cup-lip" />
          <ShieldQuestion size={22} />
        </div>
      </div>
    );
  }

  return (
    <div className="tray-stage">
      <div className={`dice-quincunx ${settled ? 'settled' : 'rolling'}`}>
        {dice.map((die, i) => (
          <span className={`quin-slot s${i}`} key={i}>
            <Die value={die} accent={die === 1} label={`${dieLabel} ${die}`} />
          </span>
        ))}
      </div>
      {!settled && (
        <>
          <canvas
            ref={canvasRef}
            className="tray-canvas"
            aria-hidden="true"
            style={{ transitionDuration: `${CROSSFADE_MS}ms` }}
          />
          <button type="button" className="tray-skip" onClick={skip}>{skipLabel}</button>
        </>
      )}
    </div>
  );
}

export { BEATS };
