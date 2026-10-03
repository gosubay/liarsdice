'use client';

// The Cup tab. A dice cup for people playing each other in person with no dice to hand:
// every player opens this on their own phone, shakes, and bids out loud. There is no
// bot, no bidding and no scoring here — it only rolls five dice and keeps them covered.
//
// The cup stays down after a shake, because a phone lying on a table is visible to the
// whole table. The player lifts it to look and covers it again. Spec: CUP_TAB_SPEC.md.

import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, RotateCcw, Sparkles, Users, Volume2, VolumeX } from 'lucide-react';

import { DiceTray } from './dice-tray';
import { useAnimationPref, useSoundPref } from './prefs';
import { playRollSound, type SoundHandle } from './roll-sound';
import { BEATS } from './roll-timing';

type Language = 'en' | 'zh';

/** How long "Shake again" stays armed waiting for the confirming second tap. */
const CONFIRM_MS = 3000;

const rollFive = () => Array.from({ length: 5 }, () => Math.floor(Math.random() * 6) + 1);

const copy = {
  en: {
    kicker: 'For playing in person',
    title: 'Dice cup',
    lede: 'Friends at the table but no dice? Everyone opens this page on their own phone. Shake, look at your five dice, and bid out loud the way you would with a real cup. There is no bot here and no scoring. It is only a cup.',
    idle: 'Tap Shake to roll your five dice.',
    covered: 'Cup is down. Lift it when nobody is looking.',
    lifted: 'Your dice',
    shake: 'Shake', shakeAgain: 'Shake again', confirm: 'Tap again to re-roll',
    lift: 'Lift cup', cover: 'Cover',
    concealed: 'Hidden dice', skipRoll: 'Skip', dieLabel: 'Die showing',
    animationOn: 'Dice animation on', animationOff: 'Dice animation off',
    soundOn: 'Sound on', soundOff: 'Sound off',
    howHead: 'How to play with it',
    how: [
      'Everyone opens this tab on their own phone.',
      'Tap Shake. The cup stays down until you lift it.',
      'Tap Lift cup to look at your dice, then Cover to hide them again.',
      'Bid out loud. When someone calls, everyone lifts their cup and shows their screen.',
      'For the next round, everyone taps Shake again. It asks for a second tap so a stray thumb cannot re-roll your hand mid-round.',
    ],
    foot: 'Every shake is a fresh random roll made on your own phone. Nothing is sent anywhere, and the phones are not connected to each other.',
  },
  zh: {
    kicker: '线下对局用',
    title: '骰盅',
    lede: '朋友到齐了却没有骰子？每个人用自己的手机打开这一页。摇骰、看自己的五粒骰，然后像用真骰盅一样开口叫骰。这里没有电脑对手，也不计分，只是一个骰盅。',
    idle: '点「摇骰」摇出你的五粒骰。',
    covered: '骰盅盖着。没人看的时候再掀开。',
    lifted: '你的骰子',
    shake: '摇骰', shakeAgain: '重新摇骰', confirm: '再点一次确认重摇',
    lift: '掀开骰盅', cover: '盖上',
    concealed: '骰子未开', skipRoll: '跳过', dieLabel: '骰子点数',
    animationOn: '开骰动画：开', animationOff: '开骰动画：关',
    soundOn: '声音：开', soundOff: '声音：关',
    howHead: '怎么用',
    how: [
      '每个人用自己的手机打开这一页。',
      '点「摇骰」。骰盅会一直盖着，直到你掀开。',
      '点「掀开骰盅」看自己的骰子，再点「盖上」藏起来。',
      '开口叫骰。有人喊开时，大家掀开骰盅，亮出屏幕。',
      '下一局，每个人点「重新摇骰」。需要点两次，免得手指误触，中途把手牌摇掉。',
    ],
    foot: '每次摇骰都是在你自己手机上产生的全新随机结果。不会上传任何数据，手机之间也没有连接。',
  },
} as const;

export function CupPage({ language }: { language: Language }) {
  const t = copy[language];
  const [animation, setAnimation] = useAnimationPref();
  const [sound, setSound] = useSoundPref();
  const [dice, setDice] = useState<number[]>([]);
  const [shakes, setShakes] = useState(0);
  const [lifted, setLifted] = useState(false);
  // Lifts since the last shake. Only the first one plays the 3D lift; after that the
  // player is just checking their hand again and should not have to wait for it.
  const [lifts, setLifts] = useState(0);
  const [armed, setArmed] = useState(false);
  const rattle = useRef<SoundHandle | null>(null);
  const rattleTimer = useRef(0);

  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), CONFIRM_MS);
    return () => window.clearTimeout(timer);
  }, [armed]);

  const stopRattle = () => {
    window.clearTimeout(rattleTimer.current);
    rattle.current?.stop();
    rattle.current = null;
  };

  useEffect(() => stopRattle, []);

  const shake = () => {
    // A hand is already under the cup, so make the player mean it.
    if (dice.length > 0 && !armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    setDice(rollFive());
    setShakes((count) => count + 1);
    setLifted(false);
    setLifts(0);
    stopRattle();
    // The cup stays down, so only the rattle is wanted: cut the sound where the lift
    // would begin.
    if (sound && animation) {
      rattle.current = playRollSound(0);
      rattleTimer.current = window.setTimeout(stopRattle, BEATS.shakeTo);
    }
  };

  const lift = () => {
    stopRattle();
    setArmed(false);
    setLifted(true);
    setLifts((count) => count + 1);
  };

  const cover = () => {
    setArmed(false);
    setLifted(false);
  };

  const rolled = dice.length > 0;
  const status = !rolled ? t.idle : lifted ? t.lifted : t.covered;

  return (
    <section className="board-shell">
      <div className="sheet-intro">
        <p className="sheet-kicker">{t.kicker}</p>
        <h1 className="sheet-title">{t.title}</h1>
        <p className="sheet-lede">{t.lede}</p>
      </div>

      <div className="cup-card" data-shakes={shakes} data-state={!rolled ? 'idle' : lifted ? 'lifted' : 'covered'}>
        <p className="cup-status" aria-live="polite">{status}</p>
        <DiceTray
          key={`${shakes}-${lifts}-${lifted}`}
          dice={dice}
          concealed={!lifted}
          reveal
          // Covered: rattle only on a fresh shake, not when the cup is put back down.
          animate={animation && (lifted ? lifts === 1 : rolled && lifts === 0)}
          sound={sound}
          hiddenLabel={t.concealed}
          skipLabel={t.skipRoll}
          dieLabel={t.dieLabel}
        />
        <div className="cup-actions">
          {rolled && (
            <button className="primary-button" onClick={lifted ? cover : lift}>
              {lifted ? <EyeOff size={17} /> : <Eye size={17} />}{lifted ? t.cover : t.lift}
            </button>
          )}
          <button className={rolled ? `cup-secondary ${armed ? 'armed' : ''}` : 'primary-button'} onClick={shake}>
            <RotateCcw size={16} />{!rolled ? t.shake : armed ? t.confirm : t.shakeAgain}
          </button>
        </div>
        <div className="toggle-row cup-toggles">
          <button type="button" className={`motion-toggle ${animation ? 'on' : ''}`} aria-pressed={animation} onClick={() => setAnimation(!animation)}>
            <Sparkles size={13} />{animation ? t.animationOn : t.animationOff}
          </button>
          <button type="button" className={`motion-toggle ${sound ? 'on' : ''}`} aria-pressed={sound} onClick={() => setSound(!sound)}>
            {sound ? <Volume2 size={13} /> : <VolumeX size={13} />}{sound ? t.soundOn : t.soundOff}
          </button>
        </div>
      </div>

      <div className="board-how">
        <h2><Users size={17} />{t.howHead}</h2>
        <ol>{t.how.map((step) => <li key={step}>{step}</li>)}</ol>
      </div>

      <p className="sheet-foot">{t.foot}</p>
    </section>
  );
}
