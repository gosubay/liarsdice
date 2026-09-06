'use client';

import { ShieldQuestion } from 'lucide-react';

export function Die({ value, hidden = false, accent = false }: { value?: number; hidden?: boolean; accent?: boolean }) {
  return (
    <span className={`die ${hidden ? 'die-hidden' : ''} ${accent ? 'die-accent' : ''}`} aria-label={hidden ? 'Hidden die' : `Die showing ${value}`}>
      {hidden ? <ShieldQuestion size={25} /> : <span className={`pip-face face-${value}`}>{Array.from({ length: value ?? 0 }, (_, i) => <i key={i} />)}</span>}
    </span>
  );
}
