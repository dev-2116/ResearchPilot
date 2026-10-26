import React, { useMemo, useState } from 'react';

/* ═══════════════════════════════════════════════════════════════════════════
   Hand-rolled SVG charts — zero extra dependencies.
   Every chart renders ONLY the real values passed in by its caller; when the
   data is empty or insufficient, callers render an honest empty state instead.
   ═══════════════════════════════════════════════════════════════════════════ */

const AMBER = '#FFAA24';
const EMERALD = '#34D399';
const ROSE = '#F87171';
const PURPLE = '#A78BFA';
const BLUE = '#60A5FA';
const GREY = '#4A5058';
const TEXT_MUTED = '#A7ADB5';

export interface Datum {
  label: string;
  value: number;
  color?: string;
}

/* ── Donut chart: proportions of a known total ────────────────────────────── */

export const DonutChart: React.FC<{
  data: Datum[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}> = ({ data, size = 168, thickness = 22, centerLabel, centerValue }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  const [hovered, setHovered] = useState<number | null>(null);

  if (total <= 0 || data.length === 0) return null;

  const r = (size - thickness) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const segments = data.map((d, i) => {
    const frac = d.value / total;
    const seg = {
      key: i,
      color: d.color || [AMBER, EMERALD, PURPLE, BLUE, ROSE, GREY][i % 6],
      dash: frac * circumference,
      offset,
      pct: Math.round(frac * 100),
      label: d.label,
      value: d.value,
    };
    offset += seg.dash;
    return seg;
  });

  const active = hovered !== null ? segments[hovered] : null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} role="img" aria-label={centerLabel || 'Distribution chart'}>
          <circle cx={c} cy={c} r={r} fill="none" stroke="var(--bg-inset)" strokeWidth={thickness} />
          {segments.map((s) => (
            <circle
              key={s.key}
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={hovered === s.key ? thickness + 4 : thickness}
              strokeDasharray={`${s.dash} ${circumference - s.dash}`}
              strokeDashoffset={-s.offset}
              strokeLinecap="butt"
              transform={`rotate(-90 ${c} ${c})`}
              style={{ transition: 'stroke-width 0.15s ease', cursor: 'pointer', opacity: hovered === null || hovered === s.key ? 1 : 0.45 }}
              onMouseEnter={() => setHovered(s.key)}
              onMouseLeave={() => setHovered(null)}
            >
              <title>{`${s.label}: ${s.value} (${s.pct}%)`}</title>
            </circle>
          ))}
        </svg>
        <div
          style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', textAlign: 'center',
          }}
        >
          <span style={{ fontSize: '1.45rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>
            {active ? `${active.pct}%` : (centerValue ?? String(total))}
          </span>
          <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', maxWidth: 90, lineHeight: 1.3 }}>
            {active ? active.label : (centerLabel || 'total')}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 130 }}>
        {segments.map((s) => (
          <div
            key={s.key}
            onMouseEnter={() => setHovered(s.key)}
            onMouseLeave={() => setHovered(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.76rem', cursor: 'default', opacity: hovered === null || hovered === s.key ? 1 : 0.55, transition: 'opacity 0.15s' }}
          >
            <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
            <span className="mono" style={{ color: 'var(--text-muted)' }}>{s.value} · {s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── Vertical bar chart: counts per category ──────────────────────────────── */

export const BarChart: React.FC<{
  data: Datum[];
  height?: number;
  unit?: string;
}> = ({ data, height = 170, unit = '' }) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.value), 1);

  if (data.length === 0) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: Math.min(18, 120 / Math.max(data.length, 1)), height, padding: '4px 2px 0' }}>
      {data.map((d, i) => {
        const h = Math.max(3, (d.value / max) * (height - 34));
        const color = d.color || AMBER;
        return (
          <div
            key={i}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            <span
              className="mono"
              style={{
                fontSize: '0.7rem', fontWeight: 600,
                color: hovered === i ? color : 'var(--text-muted)',
                opacity: hovered === null || hovered === i ? 1 : 0.5,
              }}
            >
              {d.value}{unit}
            </span>
            <div
              style={{
                width: '100%', maxWidth: 44, height: h, borderRadius: '5px 5px 2px 2px',
                background: `linear-gradient(180deg, ${color}, ${color}55)`,
                opacity: hovered === null || hovered === i ? 1 : 0.5,
                transition: 'opacity 0.15s, height 0.3s ease',
              }}
              title={`${d.label}: ${d.value}${unit}`}
            />
            <span
              style={{
                fontSize: '0.64rem', color: hovered === i ? 'var(--text-primary)' : 'var(--text-muted)',
                textAlign: 'center', lineHeight: 1.25, maxWidth: '100%', overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
              title={d.label}
            >
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};

/* ── Line chart: genuine time series with real dates ──────────────────────── */

export interface TimePoint {
  date: string; // YYYY-MM-DD (real date from records)
  value: number;
}

export const LineChart: React.FC<{
  points: TimePoint[];
  height?: number;
  color?: string;
  fillFrom?: string;
  unit?: string;
}> = ({ points, height = 180, color = AMBER, fillFrom = 'rgba(255,170,36,0.20)', unit = '' }) => {
  const W = 560;
  const H = height;
  const PADL = 30;
  const PADB = 26;
  const PADT = 12;
  const [hovered, setHovered] = useState<number | null>(null);

  const { pathD, areaD, coords, maxY } = useMemo(() => {
    if (points.length === 0) return { pathD: '', areaD: '', coords: [] as { x: number; y: number; p: TimePoint }[], maxY: 0 };
    const maxV = Math.max(...points.map((p) => p.value), 1);
    const innerW = W - PADL - 14;
    const innerH = H - PADT - PADB;
    const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;
    const coordsArr = points.map((p, i) => ({
      x: PADL + i * stepX,
      y: PADT + innerH - (p.value / maxV) * innerH,
      p,
    }));
    const d = coordsArr.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
    const area = `${d} L${coordsArr[coordsArr.length - 1].x.toFixed(1)},${H - PADB} L${coordsArr[0].x.toFixed(1)},${H - PADB} Z`;
    return { pathD: d, areaD: area, coords: coordsArr, maxY: maxV };
  }, [points, H]);

  if (points.length < 2) return null; // honest: no trend line from a single point

  const fmtLabel = (d: string) => {
    const dt = new Date(d + 'T00:00:00');
    return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
      role="img"
      aria-label="Tasks created per day (from actual records)"
      onMouseLeave={() => setHovered(null)}
    >
      {/* gridlines */}
      {[0, 0.5, 1].map((f) => {
        const y = PADT + (H - PADT - PADB) * f;
        return (
          <g key={f}>
            <line x1={PADL} x2={W - 14} y1={y} y2={y} stroke="var(--border-subtle)" strokeWidth={1} strokeDasharray={f === 1 ? '0' : '3 4'} />
            <text x={PADL - 6} y={y + 3.5} textAnchor="end" fontSize={9} fill={TEXT_MUTED} fontFamily="var(--font-mono)">
              {Math.round(maxY * (1 - f))}
            </text>
          </g>
        );
      })}

      <defs>
        <linearGradient id={`lc-grad-${color.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillFrom} />
          <stop offset="100%" stopColor="rgba(255,170,36,0)" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#lc-grad-${color.slice(1)})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />

      {/* x labels: first, middle, last */}
      {[0, Math.floor((points.length - 1) / 2), points.length - 1].map((idx, k) => (
        <text
          key={k}
          x={coords[idx].x}
          y={H - 8}
          textAnchor={idx === 0 ? 'start' : idx === points.length - 1 ? 'end' : 'middle'}
          fontSize={9.5}
          fill={TEXT_MUTED}
        >
          {fmtLabel(points[idx].date)}
        </text>
      ))}

      {coords.map((c, i) => (
        <g key={i}>
          <circle
            cx={c.x} cy={c.y} r={hovered === i ? 4.5 : 2.6}
            fill={hovered === i ? color : 'var(--bg-card)'}
            stroke={color} strokeWidth={1.6}
            style={{ transition: 'r 0.1s' }}
          />
          <rect
            x={c.x - 12} y={PADT} width={24} height={H - PADT - PADB}
            fill="transparent"
            onMouseEnter={() => setHovered(i)}
          >
            <title>{`${fmtLabel(c.p.date)}: ${c.p.value}${unit}`}</title>
          </rect>
          {hovered === i && (
            <g pointerEvents="none">
              <rect
                x={Math.min(Math.max(c.x - 46, 2), W - 96)} y={Math.max(c.y - 34, 2)}
                width={92} height={24} rx={5}
                fill="#1C2025" stroke="var(--border-medium)"
              />
              <text
                x={Math.min(Math.max(c.x, 48), W - 50)} y={Math.max(c.y - 18, 18)}
                textAnchor="middle" fontSize={10} fill="#F4F5F6" fontFamily="var(--font-mono)"
              >
                {fmtLabel(c.p.date)} · {c.p.value}{unit}
              </text>
            </g>
          )}
        </g>
      ))}
    </svg>
  );
};

/* ── Horizontal comparison bars (real labeled values) ─────────────────────── */

export const CompareBars: React.FC<{
  data: Datum[];
  maxHint?: number;
  unit?: string;
}> = ({ data, maxHint, unit = '%' }) => {
  const max = maxHint ?? Math.max(...data.map((d) => d.value), 1);
  if (data.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      {data.map((d, i) => (
        <div key={i}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 4 }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }} title={d.label}>
              {d.label}
            </span>
            <span className="mono" style={{ color: d.color || AMBER, fontWeight: 700 }}>
              {Number.isFinite(d.value) ? d.value.toLocaleString() : '—'}{unit}
            </span>
          </div>
          <div className="progress-track" style={{ height: 7 }}>
            <div
              className="progress-fill"
              style={{ width: `${Math.max(0, Math.min(100, (d.value / max) * 100))}%`, background: d.color || AMBER }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};
