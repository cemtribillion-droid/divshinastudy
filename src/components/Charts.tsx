import React from 'react';
import type { PerformancePoint } from '../utils/analytics';

export function ProgressDonut({
  percentage,
  completed,
  inProgress,
  pending,
}: {
  percentage: number;
  completed: number;
  inProgress: number;
  pending: number;
}) {
  const total = Math.max(1, completed + inProgress + pending);
  const size = 128;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const completedLen = (completed / total) * circumference;
  const inProgressLen = (inProgress / total) * circumference;
  const pendingLen = Math.max(0, circumference - completedLen - inProgressLen);

  return (
    <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-label={`Overall progress ${percentage}%`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#ECEAF6"
          strokeWidth={strokeWidth}
        />
        {pending > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#E5E3F3"
            strokeWidth={strokeWidth}
            strokeDasharray={`${pendingLen} ${circumference}`}
            strokeDashoffset={-(completedLen + inProgressLen)}
            strokeLinecap="round"
          />
        )}
        {inProgress > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#B4899E"
            strokeWidth={strokeWidth}
            strokeDasharray={`${inProgressLen} ${circumference}`}
            strokeDashoffset={-completedLen}
            strokeLinecap="round"
          />
        )}
        {completed > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#10B981"
            strokeWidth={strokeWidth}
            strokeDasharray={`${completedLen} ${circumference}`}
            strokeDashoffset={0}
            strokeLinecap="round"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-bold text-[#1A1635] tabular-nums">{percentage}%</span>
      </div>
    </div>
  );
}

export function PerformanceLineChart({ points }: { points: PerformancePoint[] }) {
  if (points.length === 0) {
    return (
      <div className="h-56 flex flex-col items-center justify-center text-center rounded-xl bg-[#FAF9FE] border border-dashed border-[#DDD6FE] px-6">
        <p className="text-sm font-medium text-[#1A1635]">No examination attempts recorded yet</p>
        <p className="text-xs text-[#6D658F] mt-1 max-w-xs">
          Complete a timed CBT or Theory examination to chart your real ND2 performance trend over time.
        </p>
      </div>
    );
  }

  const width = 520;
  const height = 210;
  const padLeft = 46;
  const padRight = 36;
  const padTop = 38;
  const padBottom = 32;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const coords = points.map((pt, i) => {
    const x = points.length === 1 ? padLeft + chartW / 2 : padLeft + (i / (points.length - 1)) * chartW;
    const y = padTop + chartH - (Math.max(0, Math.min(100, pt.score)) / 100) * chartH;
    return { ...pt, x, y };
  });

  const linePath = coords.map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
  const areaPath =
    coords.length > 1
      ? `${linePath} L ${coords[coords.length - 1].x} ${padTop + chartH} L ${coords[0].x} ${padTop + chartH} Z`
      : '';

  const latest = coords[coords.length - 1];
  const calloutX = Math.min(width - 44, Math.max(54, latest.x));
  const calloutY = Math.max(18, latest.y - 28);
  const yTicks = [0, 25, 50, 75, 100];

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-56" role="img" aria-label="Examination performance overview chart">
        <defs>
          <linearGradient id="pw-chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7B3FE4" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#7B3FE4" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {yTicks.map((tick) => {
          const y = padTop + chartH - (tick / 100) * chartH;
          return (
            <g key={tick}>
              <line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke="#ECE9F6" strokeWidth="1" />
              <text
                x={padLeft - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-[#6D658F] text-[11px] font-mono tabular-nums"
              >
                {tick}%
              </text>
            </g>
          );
        })}

        {areaPath && <path d={areaPath} fill="url(#pw-chart-fill)" />}
        {coords.length > 1 && (
          <path d={linePath} fill="none" stroke="#6B34E8" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {coords.map((c, idx) => (
          <g key={`${c.label}-${idx}`}>
            <circle cx={c.x} cy={c.y} r="4.5" fill="#6B34E8" stroke="#FFFFFF" strokeWidth="2" />
            <text
              x={c.x}
              y={height - 10}
              textAnchor="middle"
              className="fill-[#6D658F] text-[11px]"
            >
              {c.courseCode}
            </text>
          </g>
        ))}

        {/* Latest score pill callout matching reference */}
        <g transform={`translate(${calloutX}, ${calloutY})`}>
          <rect x="-24" y="-12" width="48" height="22" rx="11" fill="#2A1B6A" />
          <polygon points="-4,10 4,10 0,15" fill="#2A1B6A" />
          <text
            x="0"
            y="3"
            textAnchor="middle"
            className="fill-white text-[11px] font-semibold font-mono tabular-nums"
          >
            {latest.score}%
          </text>
        </g>
      </svg>
    </div>
  );
}
