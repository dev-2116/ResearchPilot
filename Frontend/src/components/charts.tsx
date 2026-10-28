import React, { useMemo, useState } from 'react';
import { MonthlyInvestigation } from '../types';

/* ═══════════════════════════════════════════════════════════════════════════
   Academic Charts — Light Blue Palette (zero extra dependencies).
   Renders ONLY real recorded data; empty states when data is insufficient.
   ═══════════════════════════════════════════════════════════════════════════ */

const BLUE = '#3695F5';
const CHARCOAL = '#252A31';
const SLATE = '#596579';
const EMERALD = '#10B981';
const ROSE = '#DC2626';
const AMBER = '#D97706';
const GREY = '#CBD5E1';
const TEXT_MUTED = '#8A95A5';

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
  const palette = [BLUE, '#2563EB', '#60A5FA', CHARCOAL, EMERALD, SLATE];
  const segments = data.map((d, i) => {
    const frac = d.value / total;
    const seg = {
      key: i,
      color: d.color || palette[i % palette.length],
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} role="img" aria-label={centerLabel || 'Distribution chart'}>
          <circle cx={c} cy={c} r={r} fill="none" stroke="#EBF2FA" strokeWidth={thickness} />
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
          <span style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>
            {active ? `${active.pct}%` : (centerValue ?? String(total))}
          </span>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', maxWidth: 90, lineHeight: 1.3 }}>
            {active ? active.label : (centerLabel || 'total')}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, minWidth: 140 }}>
        {segments.map((s) => (
          <div
            key={s.key}
            onMouseEnter={() => setHovered(s.key)}
            onMouseLeave={() => setHovered(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', cursor: 'default', opacity: hovered === null || hovered === s.key ? 1 : 0.55, transition: 'opacity 0.15s' }}
          >
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
            <span className="mono" style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>{s.value} ({s.pct}%)</span>
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
        const h = Math.max(4, (d.value / max) * (height - 36));
        const color = d.color || BLUE;
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
                fontSize: '0.72rem', fontWeight: 600,
                color: hovered === i ? color : 'var(--text-muted)',
                opacity: hovered === null || hovered === i ? 1 : 0.5,
              }}
            >
              {d.value}{unit}
            </span>
            <div
              style={{
                width: '100%', maxWidth: 42, height: h, borderRadius: '5px 5px 2px 2px',
                background: color,
                opacity: hovered === null || hovered === i ? 1 : 0.45,
                transition: 'opacity 0.15s, height 0.3s ease',
              }}
              title={`${d.label}: ${d.value}${unit}`}
            />
            <span
              style={{
                fontSize: '0.66rem', color: hovered === i ? 'var(--text-primary)' : 'var(--text-muted)',
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
  date: string; // YYYY-MM-DD
  value: number;
}

export const LineChart: React.FC<{
  points: TimePoint[];
  height?: number;
  color?: string;
  fillFrom?: string;
  unit?: string;
}> = ({ points, height = 180, color = BLUE, fillFrom = 'rgba(54, 149, 245, 0.18)', unit = '' }) => {
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

  if (points.length < 2) return null;

  const fmtLabel = (d: string) => {
    const dt = new Date(d + 'T00:00:00');
    return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const gradId = `lc-grad-${color.replace(/[^a-zA-Z0-9]/g, '')}`;

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
            <line x1={PADL} x2={W - 14} y1={y} y2={y} stroke="#E1E8F0" strokeWidth={1} strokeDasharray={f === 1 ? '0' : '3 4'} />
            <text x={PADL - 6} y={y + 3.5} textAnchor="end" fontSize={9} fill={TEXT_MUTED} fontFamily="var(--font-mono)">
              {Math.round(maxY * (1 - f))}
            </text>
          </g>
        );
      })}

      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillFrom} />
          <stop offset="100%" stopColor="rgba(54, 149, 245, 0)" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gradId})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />

      {/* x labels */}
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
            fill={hovered === i ? color : '#FFFFFF'}
            stroke={color} strokeWidth={1.8}
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
                width={92} height={24} rx={6}
                fill="#252A31" stroke="#3695F5" strokeWidth={1}
              />
              <text
                x={Math.min(Math.max(c.x, 48), W - 50)} y={Math.max(c.y - 18, 18)}
                textAnchor="middle" fontSize={10} fill="#FFFFFF" fontFamily="var(--font-mono)" fontWeight={600}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {data.map((d, i) => (
        <div key={i}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 5 }}>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }} title={d.label}>
              {d.label}
            </span>
            <span className="mono" style={{ color: d.color || BLUE, fontWeight: 700 }}>
              {Number.isFinite(d.value) ? d.value.toLocaleString() : '—'}{unit}
            </span>
          </div>
          <div className="progress-track" style={{ height: 8 }}>
            <div
              className="progress-fill"
              style={{ width: `${Math.max(0, Math.min(100, (d.value / max) * 100))}%`, background: d.color || BLUE }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

/* ── Monthly Investigations Bar Chart (12 Months, Real Data, Academic Blue) ── */

export const MonthlyInvestigationsChart: React.FC<{
  data: MonthlyInvestigation[];
  height?: number;
  year?: number;
}> = ({ data, height = 195, year }) => {
  const [hovered, setHovered] = useState<number | null>(null);

  // Fallback to all 12 zero-month items if data is missing or incomplete
  const monthData = useMemo(() => {
    if (data && data.length === 12) return data;
    const names = [
      ['Jan', 'January', 1], ['Feb', 'February', 2], ['Mar', 'March', 3],
      ['Apr', 'April', 4], ['May', 'May', 5], ['Jun', 'June', 6],
      ['Jul', 'July', 7], ['Aug', 'August', 8], ['Sep', 'September', 9],
      ['Oct', 'October', 10], ['Nov', 'November', 11], ['Dec', 'December', 12]
    ] as const;
    const y = year || new Date().getFullYear();
    const map = new Map((data || []).map((d) => [d.month_num, d]));
    return names.map(([shortM, fullM, num]) => {
      const existing = map.get(num);
      return existing || {
        month: shortM,
        month_full: fullM,
        month_num: num,
        year: y,
        count: 0,
      };
    });
  }, [data, year]);

  const total = useMemo(() => monthData.reduce((s, d) => s + d.count, 0), [monthData]);
  const maxCount = useMemo(() => Math.max(...monthData.map((d) => d.count), 0), [monthData]);

  // Current calendar month detection for subtle highlight
  const now = new Date();
  const currentMonthNum = now.getMonth() + 1;
  const currentYearVal = now.getFullYear();

  // SVG Geometry
  const W = 520;
  const H = height;
  const PADL = 32;
  const PADR = 12;
  const PADT = 22;
  const PADB = 28;
  const innerW = W - PADL - PADR;
  const innerH = H - PADT - PADB;
  const baselineY = PADT + innerH;

  // Clean integer tick marks
  const { ceiling, ticks } = useMemo(() => {
    let step = 1;
    if (maxCount > 20) step = Math.ceil(maxCount / 4 / 5) * 5;
    else if (maxCount > 10) step = 5;
    else if (maxCount > 4) step = 2;
    else step = 1;

    const tickCount = Math.max(4, Math.ceil(Math.max(maxCount, 1) / step));
    const maxTick = tickCount * step;
    const t: number[] = [];
    for (let v = 0; v <= maxTick; v += step) {
      t.push(v);
    }
    return { ceiling: maxTick, ticks: t };
  }, [maxCount]);

  const slotW = innerW / 12;
  const barW = Math.max(16, Math.min(22, slotW * 0.58));

  return (
    <div style={{ position: 'relative', width: '100%', userSelect: 'none' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        role="img"
        aria-label="Monthly Investigations Bar Chart"
        onMouseLeave={() => setHovered(null)}
      >
        {/* Horizontal subtle grid lines & integer Y-axis ticks */}
        {ticks.map((t) => {
          const y = baselineY - (t / ceiling) * innerH;
          return (
            <g key={t}>
              <line
                x1={PADL}
                x2={W - PADR}
                y1={y}
                y2={y}
                stroke="#E1E8F0"
                strokeWidth={1}
                strokeDasharray={t === 0 ? undefined : '3 3'}
              />
              <text
                x={PADL - 7}
                y={y + 3.5}
                textAnchor="end"
                fontSize={9.5}
                fill="#8A95A5"
                fontFamily="var(--font-mono)"
                fontWeight={500}
              >
                {t}
              </text>
            </g>
          );
        })}

        {/* 12 Monthly Bars and X-Axis Labels */}
        {monthData.map((d, i) => {
          const cx = PADL + (i + 0.5) * slotW;
          const bx = cx - barW / 2;
          const barH = (d.count / ceiling) * innerH;
          const by = baselineY - barH;
          const isCurrentMonth = d.year === currentYearVal && d.month_num === currentMonthNum;
          const isHovered = hovered === i;

          // Palette: Primary #3695F5, Current month highlighted with stronger #2563EB
          const baseColor = isCurrentMonth ? '#2563EB' : '#3695F5';
          const fillColor = isHovered ? (isCurrentMonth ? '#1D4ED8' : '#2563EB') : baseColor;

          return (
            <g key={d.month_num}>
              {/* Invisible touch/hover target over the full slot height */}
              <rect
                x={cx - slotW / 2}
                y={PADT}
                width={slotW}
                height={innerH + PADB}
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHovered(i)}
              />

              {/* Baseline indicator for 0-count months */}
              {d.count === 0 ? (
                <rect
                  x={bx + barW * 0.15}
                  y={baselineY - 1.5}
                  width={barW * 0.7}
                  height={2}
                  rx={1}
                  fill={isHovered ? '#3695F5' : '#DCE8F6'}
                  style={{ transition: 'fill 0.15s ease' }}
                />
              ) : (
                /* Active vertical bar with rounded top */
                <rect
                  x={bx}
                  y={by}
                  width={barW}
                  height={Math.max(barH, 3)}
                  rx={3}
                  ry={3}
                  fill={fillColor}
                  style={{
                    transition: 'fill 0.15s ease, opacity 0.15s ease',
                    opacity: hovered === null || isHovered ? 1 : 0.7,
                  }}
                />
              )}

              {/* Current month small top indicator dot if count > 0 */}
              {isCurrentMonth && d.count > 0 && (
                <circle
                  cx={cx}
                  cy={by - 5}
                  r={2.2}
                  fill="#2563EB"
                />
              )}

              {/* Month label along X-axis */}
              <text
                x={cx}
                y={baselineY + 16}
                textAnchor="middle"
                fontSize={10}
                fontWeight={isCurrentMonth ? 700 : isHovered ? 600 : 500}
                fill={isCurrentMonth ? '#252B35' : isHovered ? '#252B35' : '#8A95A5'}
                fontFamily="var(--font-heading)"
              >
                {d.month}
              </text>
            </g>
          );
        })}

        {/* Hover Tooltip (Smooth floating SVG group) */}
        {hovered !== null && monthData[hovered] && (() => {
          const d = monthData[hovered];
          const cx = PADL + (hovered + 0.5) * slotW;
          const barH = (d.count / ceiling) * innerH;
          const by = d.count > 0 ? baselineY - barH : baselineY;
          const isCurrentMonth = d.year === currentYearVal && d.month_num === currentMonthNum;

          // Tooltip card dimensions
          const tw = 120;
          const th = 38;
          // Clamp X to stay within SVG canvas
          const tx = Math.min(Math.max(cx - tw / 2, PADL + 4), W - PADR - tw - 4);
          const ty = Math.max(PADT - 4, by - th - 8);

          return (
            <g pointerEvents="none" style={{ transition: 'all 0.1s ease' }}>
              {/* Tooltip background card */}
              <rect
                x={tx}
                y={ty}
                width={tw}
                height={th}
                rx={6}
                fill="#252B35"
                stroke="#3695F5"
                strokeWidth={1}
                filter="drop-shadow(0 4px 12px rgba(37,43,53,0.18))"
              />
              {/* Tooltip month header */}
              <text
                x={tx + tw / 2}
                y={ty + 14}
                textAnchor="middle"
                fontSize={9.5}
                fontWeight={600}
                fill="#CBD5E1"
                fontFamily="var(--font-heading)"
              >
                {d.month_full} {d.year} {isCurrentMonth ? '• Now' : ''}
              </text>
              {/* Tooltip count display */}
              <text
                x={tx + tw / 2}
                y={ty + 28}
                textAnchor="middle"
                fontSize={11}
                fontWeight={700}
                fill="#FFFFFF"
                fontFamily="var(--font-mono)"
              >
                {d.count} {d.count === 1 ? 'investigation' : 'investigations'}
              </text>
            </g>
          );
        })()}
      </svg>

      {/* Empty State Overlay when year has zero total investigations */}
      {total === 0 && (
        <div
          style={{
            position: 'absolute',
            top: '42%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(4px)',
            border: '1px solid #E1E8F0',
            borderRadius: '8px',
            padding: '8px 16px',
            textAlign: 'center',
            boxShadow: '0 2px 10px rgba(37,43,53,0.06)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#252B35' }}>
            No investigations recorded this year yet.
          </div>
          <div style={{ fontSize: '0.72rem', color: '#8A95A5', marginTop: 2 }}>
            All 12 calendar months are initialized and ready for research activity.
          </div>
        </div>
      )}
    </div>
  );
};
