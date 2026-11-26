interface SparklineProps {
  values: number[];
  fill?: string;
  className?: string;
}

/** A filled micro-line used behind the KPI numbers. */
export function Sparkline({ values, fill = 'rgba(255,255,255,.05)', className }: SparklineProps) {
  const w = 116;
  const h = 38;

  
  if (values.length < 2) return <svg className={className} viewBox={`0 0 ${w} ${h}`} />;

  const max = Math.max(...values) || 1;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - 2 - (v / max) * (h - 7);
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  const line = `M${points.join(' L')}`;

  return (
    <svg className={className} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={`${line} L${w} ${h} L0 ${h} Z`} fill={fill} />
      <path d={line} fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="1.2" />
    </svg>
  );
}

interface RingProps {
  pct: number;
  className?: string;
}

/** Small progress ring in the "Completed" KPI tile. */
export function Ring({ pct, className }: RingProps) {
  const r = 18;
  const c = 2 * Math.PI * r;
  return (
    <svg className={className} viewBox="0 0 44 44" aria-hidden="true">
      <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,255,255,.09)" strokeWidth="4" />
      <circle
        cx="22"
        cy="22"
        r={r}
        fill="none"
        stroke="var(--green)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct / 100)}
        transform="rotate(-90 22 22)"
        style={{ transition: 'stroke-dashoffset .7s cubic-bezier(.25,.9,.3,1)' }}
      />
    </svg>
  );
}

export interface Segment {
  value: number;
  color: string;
  label: string;
}

/** The large status donut. */
export function Donut({ segments }: { segments: Segment[] }) {
  const r = 48;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  let offset = 0;

  return (
    <svg viewBox="0 0 120 120" role="img" aria-label="Issue status breakdown">
      <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="13" />
      {segments.map((s) => {
        if (s.value <= 0) return null;
        const len = (s.value / total) * c;
        const node = (
          <circle
            key={s.label}
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth="13"
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 60 60)"
            style={{ transition: 'stroke-dasharray .7s cubic-bezier(.25,.9,.3,1)' }}
          >
            <title>{`${s.label}: ${s.value}`}</title>
          </circle>
        );
        offset += len;
        return node;
      })}
    </svg>
  );
}
