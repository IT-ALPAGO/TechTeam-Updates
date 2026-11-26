import { useEffect, useRef, useState } from 'react';
import { ChevronDownIcon } from './Icons';
import { formatStamp } from '../lib/metrics';
import type { Range } from '../types';

interface Props {
  ranges: Range[];
  range: Range;
  onRange: (r: Range) => void;
  connected: boolean;
  loading: boolean;
  fetchedAt: Date | null;
}

export function TopBar({ ranges, range, onRange, connected, loading, fetchedAt }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const label = loading ? 'Syncing' : connected ? 'Live' : 'Not connected';

  return (
    <div className="topbar">
      <div className={`live${connected ? '' : ' off'}`}>
        <span className="dot" />
        <span>{label}</span>
        <span className="sep">•</span>
        <span>{formatStamp(fetchedAt ?? new Date())}</span>
      </div>

      <div className={`range${open ? ' open' : ''}`} ref={wrapRef}>
        <button
          className="range-btn"
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span>{range.label}</span>
          <ChevronDownIcon />
        </button>
        <div className="range-menu" role="listbox">
          {ranges.map((r) => (
            <button
              key={r.id}
              type="button"
              role="option"
              aria-selected={r.id === range.id}
              className={r.id === range.id ? 'on' : undefined}
              onClick={() => {
                onRange(r);
                setOpen(false);
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
